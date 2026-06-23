import { GraphDB } from '../kg/graphDB';
import { run_graph } from '../core/graph';
import { MarketData, InvestmentRunResult } from '../../types';

export class InvestmentEngine {
  private db: GraphDB;

  constructor(db: GraphDB) {
    this.db = db;
  }

  /**
   * Main entry point to run an investment cycle on a symbol
   */
  public async run(symbol: string, query: string, marketData: MarketData): Promise<InvestmentRunResult> {
    const cleanSym = symbol.trim().toUpperCase();

    // 1. Load context from Knowledge Graph
    const kgContext = this.db.load_stock_context(cleanSym);

    // Get current market state from context, fallback to ACCUMULATION
    let currentState = "ACCUMULATION";
    const regimeRecord = kgContext.filter(c => c.type === 'MARKET_REGIME');
    if (regimeRecord.length > 0) {
      // Sort by latest timestamp
      regimeRecord.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      currentState = regimeRecord[0].value;
    }

    // 2. Execute modern multi-agent pipeline with Gemini
    const result = await run_graph(cleanSym, query, marketData, currentState, kgContext);

    // 3. Persist the generated signals in the Knowledge Graph for historical memory
    for (const [sigKey, sigVal] of Object.entries(result.signals)) {
      this.db.write_signal(cleanSym, sigKey, sigVal);
    }

    // 4. Persistence of calculated market regime state to the Knowledge Graph
    this.db.write_market_state(cleanSym, result.market_state);

    return {
      symbol: cleanSym,
      query,
      market_data: marketData,
      market_state: result.market_state,
      signals: result.signals,
      opinions: [result.opinion],
      final_decision: result.final_decision,
      timestamp: new Date().toISOString(),
      execution_log: result.execution_log
    };
  }
}
