import fs from 'fs';
import path from 'path';
import { GraphNode, GraphRelationship } from '../../types';

export class GraphDB {
  private filePath: string;
  private nodes: GraphNode[] = [];
  private relationships: GraphRelationship[] = [];

  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'graph_db.json');
    this.ensureDirectoryExistence();
    this.load();
    if (this.nodes.length === 0) {
      this.seedDemoData();
    }
  }

  private ensureDirectoryExistence() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.nodes = data.nodes || [];
        this.relationships = data.relationships || [];
      }
    } catch (e) {
      console.error("Failed to load Knowledge Graph from disk, starting fresh.", e);
      this.nodes = [];
      this.relationships = [];
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify({
        nodes: this.nodes,
        relationships: this.relationships
      }, null, 2), 'utf-8');
    } catch (e) {
      console.error("Failed to save Knowledge Graph to disk", e);
    }
  }

  public getGraph() {
    return {
      nodes: this.nodes,
      relationships: this.relationships
    };
  }

  /**
   * Loads signals and states associated with a specific stock.
   */
  public load_stock_context(symbol: string): Array<{ type: string; value: any; timestamp: string }> {
    const context: Array<{ type: string; value: any; timestamp: string }> = [];

    // Find the stock node
    const stockNode = this.nodes.find(n => n.type === 'Stock' && n.properties.symbol === symbol.toUpperCase());
    if (!stockNode) return [];

    // Find all signals or regimes connected to this stock
    const rels = this.relationships.filter(r => r.source === stockNode.id);
    for (const rel of rels) {
      const targetNode = this.nodes.find(n => n.id === rel.target);
      if (targetNode) {
        if (targetNode.type === 'Signal') {
          context.push({
            type: targetNode.properties.type,
            value: targetNode.properties.value,
            timestamp: targetNode.properties.timestamp || new Date().toISOString()
          });
        } else if (targetNode.type === 'MarketRegime') {
          context.push({
            type: 'MARKET_REGIME',
            value: targetNode.properties.state,
            timestamp: targetNode.properties.timestamp || new Date().toISOString()
          });
        }
      }
    }

    return context;
  }

  /**
   * Add/merge a Stock node
   */
  public mergeStock(symbol: string, companyName: string): string {
    const upperSym = symbol.toUpperCase();
    const existing = this.nodes.find(n => n.type === 'Stock' && n.properties.symbol === upperSym);
    if (existing) {
      return existing.id;
    }

    const id = `stock_${upperSym}_${Date.now()}`;
    this.nodes.push({
      id,
      label: upperSym,
      type: 'Stock',
      properties: { symbol: upperSym, company_name: companyName, timestamp: new Date().toISOString() }
    });
    this.save();
    return id;
  }

  /**
   * Write signal event and tie to Stock node
   */
  public write_signal(symbol: string, signalType: string, value: any): string {
    const stockId = this.mergeStock(symbol, `${symbol} Corporation`);
    const signalId = `sig_${signalType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const timestamp = new Date().toISOString();
    // Create signal node
    this.nodes.push({
      id: signalId,
      label: `${signalType}: ${JSON.stringify(value)}`,
      type: 'Signal',
      properties: { type: signalType, value, timestamp }
    });

    // Create edge stock -> signal
    this.relationships.push({
      id: `rel_${stockId}_has_${signalId}`,
      source: stockId,
      target: signalId,
      type: 'HAS_SIGNAL',
    });

    this.save();
    return signalId;
  }

  /**
   * Write regime state and tie to Stock node
   */
  public write_market_state(symbol: string, state: string): string {
    const stockId = this.mergeStock(symbol, `${symbol} Corporation`);
    const regimeId = `regime_${state}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const timestamp = new Date().toISOString();
    this.nodes.push({
      id: regimeId,
      label: `State: ${state}`,
      type: 'MarketRegime',
      properties: { state, timestamp }
    });

    this.relationships.push({
      id: `rel_${stockId}_in_${regimeId}`,
      source: stockId,
      target: regimeId,
      type: 'IN_STATE',
      properties: { timestamp }
    });

    this.save();
    return regimeId;
  }

  /**
   * Seeds realistic demo data for the first view
   */
  public seedDemoData() {
    this.nodes = [];
    this.relationships = [];

    const stocks = [
      { sym: 'AAPL', name: 'Apple Inc.' },
      { sym: 'TSLA', name: 'Tesla Inc.' },
      { sym: 'NVDA', name: 'Nvidia Corp.' },
      { sym: 'BTC', name: 'Bitcoin Network' }
    ];

    stocks.forEach((s, idx) => {
      const stockId = `stock_${s.sym}`;
      this.nodes.push({
        id: stockId,
        label: s.sym,
        type: 'Stock',
        properties: { symbol: s.sym, company_name: s.name, timestamp: new Date().toISOString() }
      });

      // Historical market state
      const preState = idx % 2 === 0 ? 'ACCUMULATION' : 'TREND_EXPANSION';
      const regimeId = `regime_${s.sym}_init`;
      this.nodes.push({
        id: regimeId,
        label: `State: ${preState}`,
        type: 'MarketRegime',
        properties: { state: preState, timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString() }
      });

      this.relationships.push({
        id: `rel_${stockId}_in_${regimeId}`,
        source: stockId,
        target: regimeId,
        type: 'IN_STATE',
        properties: { timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString() }
      });

      // Historical signals
      const sigs = [
        { type: 'volume_breakout', val: s.sym === 'NVDA' || s.sym === 'BTC' },
        { type: 'trend_confirmed', val: true }
      ];

      sigs.forEach((sig, sIdx) => {
        const sigId = `sig_${s.sym}_${sig.type}`;
        this.nodes.push({
          id: sigId,
          label: `${sig.type}: ${sig.val}`,
          type: 'Signal',
          properties: { type: sig.type, value: sig.val, timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString() }
        });

        this.relationships.push({
          id: `rel_${stockId}_has_${sigId}`,
          source: stockId,
          target: sigId,
          type: 'HAS_SIGNAL'
        });
      });
    });

    this.save();
    console.log("Successfully seeded demo data for Knowledge Graph!");
  }
}
