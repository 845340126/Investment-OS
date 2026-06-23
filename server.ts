import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environmental variables
dotenv.config();

import { GraphDB } from './src/server/kg/graphDB';
import { InvestmentEngine } from './src/server/runtime/engine';
import { BrokerClient } from './src/server/tools/broker_client';
import { MarketData } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Initialize DB & Engine
  const db = new GraphDB();
  const engine = new InvestmentEngine(db);
  const broker = new BrokerClient();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get full Knowledge Graph structure
  app.get('/api/graph', (req, res) => {
    try {
      const graph = db.getGraph();
      res.json(graph);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Triggers engine execution on a target stock with custom metrics
  app.post('/api/run', async (req, res) => {
    const { symbol, query, market_data } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Missing target symbol.' });
    }

    try {
      // Execute the decision cycle
      const result = await engine.run(symbol, query || 'Inference State', market_data);
      res.json(result);
    } catch (e) {
      console.error("Engine execution failure in server", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Fetches market indicators for a stock (directly querying our mock/real BrokerClient)
  app.get('/api/broker/indicators/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
      const metrics = await broker.fetchMarketIndicators(symbol);
      res.json(metrics);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Manually seeds / Resets graph db to demo presets
  app.post('/api/seed', (req, res) => {
    try {
      db.seedDemoData();
      res.json({ success: true, graph: db.getGraph() });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Vite static assets serving logic
  if (process.env.NODE_ENV !== 'production') {
    console.log("Vite running in development mode (HMR bypassed)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving built production assets from /dist...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Investment OS Service] successfully booted on port ${PORT}`);
    console.log(`- API health: http://localhost:${PORT}/api/health`);
    console.log(`- Graph query: http://localhost:${PORT}/api/graph`);
  });
}

startServer().catch((e) => {
  console.error("Boot failure in custom server start method", e);
});
