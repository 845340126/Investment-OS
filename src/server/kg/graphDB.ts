import fs from 'fs';
import path from 'path';
import { GraphNode, GraphRelationship } from '../../types';

/**
 * Interface representing a future standard Neo4j Graph DB Connection driver
 * This keeps the application modular and ready for real enterprise deployment.
 */
export interface INeo4jDriver {
  connect(): Promise<boolean>;
  runCypher(query: string, params?: Record<string, any>): Promise<any>;
  close(): Promise<void>;
}

export class DummyNeo4jConnector implements INeo4jDriver {
  private uri: string;
  constructor(uri: string = "neo4j://localhost:7687") {
    this.uri = uri;
  }
  async connect() {
    console.log(`[PROXIED] Initializing connection to Neo4j database instance at: ${this.uri}...`);
    return true;
  }
  async runCypher(query: string, params?: Record<string, any>) {
    console.log(`[CYPHER EXECUTE]: ${query} with params ${JSON.stringify(params)}`);
    return { records: [] };
  }
  async close() {
    console.log("[PROXIED] Closed session with Neo4j driver cleanly.");
  }
}

export class GraphDB {
  private filePath: string;
  private nodes: GraphNode[] = [];
  private relationships: GraphRelationship[] = [];
  
  // Real-time index lookups to maintain O(1) searches as nodes grow to thousands
  private nodeByIdMap: Map<string, GraphNode> = new Map();
  private stockSymbolMap: Map<string, GraphNode> = new Map();
  private relationshipsBySourceMap: Map<string, GraphRelationship[]> = new Map();

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

  private rebuidIndices() {
    this.nodeByIdMap.clear();
    this.stockSymbolMap.clear();
    this.relationshipsBySourceMap.clear();

    for (const node of this.nodes) {
      this.nodeByIdMap.set(node.id, node);
      if (node.type === 'Stock' && node.properties.symbol) {
        this.stockSymbolMap.set(node.properties.symbol.toUpperCase(), node);
      }
    }

    for (const rel of this.relationships) {
      const list = this.relationshipsBySourceMap.get(rel.source) || [];
      list.push(rel);
      this.relationshipsBySourceMap.set(rel.source, list);
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.nodes = data.nodes || [];
        this.relationships = data.relationships || [];
        this.rebuidIndices();
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
      this.rebuidIndices();
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
   * Pagination Query Helper to support millions of nodes without overloading client
   */
  public getNodesPaginated(page: number = 1, pageSize: number = 20) {
    const start = (page - 1) * pageSize;
    return {
      items: this.nodes.slice(start, start + pageSize),
      totalCount: this.nodes.length,
      page,
      pageSize,
      totalPages: Math.ceil(this.nodes.length / pageSize)
    };
  }

  /**
   * Loads signals and states associated with a specific stock.
   * Leverages pre-built system indices for O(1) performance.
   */
  public load_stock_context(symbol: string): Array<{ type: string; label?: string; value: any; properties?: Record<string, any>; timestamp: string }> {
    const context: Array<{ type: string; label?: string; value: any; properties?: Record<string, any>; timestamp: string }> = [];

    const stockNode = this.stockSymbolMap.get(symbol.toUpperCase());
    if (!stockNode) return [];

    const rels = this.relationshipsBySourceMap.get(stockNode.id) || [];
    for (const rel of rels) {
      const targetNode = this.nodeByIdMap.get(rel.target);
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

          // Also get nested custom CausalFactor nodes linked through this MarketRegime node
          const nestedRels = this.relationshipsBySourceMap.get(targetNode.id) || [];
          for (const nestedRel of nestedRels) {
            const nestedNode = this.nodeByIdMap.get(nestedRel.target);
            if (nestedNode && nestedNode.type === 'CausalFactor') {
              context.push({
                type: 'CausalFactor',
                label: nestedNode.label,
                value: nestedNode.properties.value,
                properties: nestedNode.properties,
                timestamp: nestedNode.properties.timestamp || new Date().toISOString()
              });
            }
          }
        } else if (targetNode.type === 'FeedBack') {
          context.push({
            type: 'FEEDBACK',
            label: targetNode.label,
            value: targetNode.properties.status,
            properties: targetNode.properties,
            timestamp: targetNode.properties.timestamp || new Date().toISOString()
          });
        }
      }
    }

    return context;
  }

  /**
   * Add/merge a Stock node with support for updating company names and labels
   */
  public mergeStock(symbol: string, companyName?: string): string {
    const upperSym = symbol.toUpperCase();
    const existing = this.stockSymbolMap.get(upperSym);
    const defaultName = companyName || `${upperSym} 证券`;
    
    if (existing) {
      if (companyName && (!existing.properties.company_name || existing.properties.company_name.includes('Corporation') || existing.properties.company_name.includes('证券'))) {
        existing.properties.company_name = companyName;
        existing.label = `${upperSym} (${companyName})`;
        this.save();
      }
      return existing.id;
    }

    const id = `stock_${upperSym}_${Date.now()}`;
    this.nodes.push({
      id,
      label: companyName ? `${upperSym} (${companyName})` : upperSym,
      type: 'Stock',
      properties: { symbol: upperSym, company_name: defaultName, timestamp: new Date().toISOString() }
    });
    this.save();
    return id;
  }

  /**
   * Write signal event and tie to Stock node
   */
  public write_signal(symbol: string, signalType: string, value: any): string {
    const stockId = this.mergeStock(symbol);
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
    const stockId = this.mergeStock(symbol);
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
   * Write causal macro factor connected to a target node
   */
  public write_causal_factor(symbol: string, label: string, factorType: string, targetNodeId: string): string {
    const factorId = `causal_${factorType}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const timestamp = new Date().toISOString();

    this.nodes.push({
      id: factorId,
      label,
      type: 'CausalFactor',
      properties: { factor_type: factorType, value: label, timestamp, symbol }
    });

    this.relationships.push({
      id: `rel_${targetNodeId}_caused_by_${factorId}`,
      source: targetNodeId,
      target: factorId,
      type: 'CAUSED_BY',
      properties: { timestamp }
    });

    this.save();
    return factorId;
  }

  /**
   * Write accuracy verification or performance feedback log to stock
   */
  public write_feedback(symbol: string, status: string, notes: string): string {
    const stockId = this.mergeStock(symbol);
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const timestamp = new Date().toISOString();

    this.nodes.push({
      id: feedbackId,
      label: `历史反馈: ${status}`,
      type: 'FeedBack',
      properties: { status, notes, timestamp }
    });

    this.relationships.push({
      id: `rel_${stockId}_feedback_${feedbackId}`,
      source: stockId,
      target: feedbackId,
      type: 'HAS_FEEDBACK',
      properties: { timestamp }
    });

    this.save();
    return feedbackId;
  }

  /**
   * Seeds realistic demo data for the first view with rich chronological sequence items
   */
  public seedDemoData() {
    this.nodes = [];
    this.relationships = [];

    const stocks = [
      { sym: '600519', name: '贵州茅台' },
      { sym: '000002', name: '万科A' },
      { sym: '300750', name: '宁德时代' },
      { sym: '601318', name: '中国平安' }
    ];

    stocks.forEach((s, idx) => {
      const stockId = `stock_${s.sym}`;
      
      // High-Fidelity Chronological Series Data representing 5 historical days of prices
      const priceSeries = idx === 0 
        ? [1680.0, 1695.5, 1710.2, 1705.0, 1720.5] // Moutai style
        : (idx === 1 
          ? [9.5, 9.2, 9.0, 8.6, 8.45] // Vanke style
          : (idx === 2 
            ? [175.4, 178.2, 180.1, 182.5, 184.8] // CATL
            : [41.2, 41.5, 41.8, 42.0, 42.15])); // Ping An

      const volumeSeries = [1200000, 1300000, 1420000, 1650000, 1800000];

      this.nodes.push({
        id: stockId,
        label: `${s.sym} (${s.name})`,
        type: 'Stock',
        properties: { 
          symbol: s.sym, 
          company_name: s.name, 
          timestamp: new Date().toISOString(),
          historical_prices: priceSeries,
          historical_volumes: volumeSeries,
          time_window: '5D_Chronological'
        }
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

      // Seeding causal macro vectors linked to states and signals (Explains WHY)
      let macroFactorLabel = "";
      let macroFactorType = "";
      if (idx === 0) {
        macroFactorLabel = "降准政策落地 / 高端消费高壁垒溢价";
        macroFactorType = "MONETARY_POLICY";
      } else if (idx === 1) {
        macroFactorLabel = "地产行业信用筑底 / 融资链条阶段性承压";
        macroFactorType = "INDUSTRY_DEBT_RISK";
      } else if (idx === 2) {
        macroFactorLabel = "新能源固态电池突破 / 全球碳减排补贴利好";
        macroFactorType = "GLOBAL_TRADE";
      } else {
        macroFactorLabel = "长期国债收益率走低 / 核心高股息资产重估";
        macroFactorType = "INTEREST_RATE";
      }

      const macroId = `causal_${s.sym}_macro`;
      this.nodes.push({
        id: macroId,
        label: macroFactorLabel,
        type: 'CausalFactor',
        properties: { factor_type: macroFactorType, value: macroFactorLabel, timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), symbol: s.sym }
      });

      // Macro causally triggers state
      this.relationships.push({
        id: `rel_${regimeId}_caused_by_${macroId}`,
        source: regimeId,
        target: macroId,
        type: 'CAUSED_BY',
        properties: { timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString() }
      });

      // Historical signals
      const sigs = [
        { type: 'volume_breakout', val: s.sym === '300750' || s.sym === '600519' },
        { type: 'trend_confirmed', val: s.sym !== '000002' }
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

        // Flow/Technical signal caused by our macro environment node
        this.relationships.push({
          id: `rel_${sigId}_caused_by_${macroId}`,
          source: sigId,
          target: macroId,
          type: 'CAUSED_BY'
        });
      });

      // Write historical feedback block
      const prevFeedbackId = `feedback_${s.sym}_init`;
      const accuracyScore = idx !== 1 ? "完全一致 (92% 置信度)" : "稍有偏离 (防诱多预警修正)";
      const feedbackNotes = idx !== 1 
        ? "机器状态机诊断结果与资产实际走势完美拟合，AI 独立复核稳定。" 
        : "系统于突破阶段侦测到大资金异动撤离，成功阻断交易员高位追涨，挽回假突破回撤。";

      this.nodes.push({
        id: prevFeedbackId,
        label: `反馈: ${accuracyScore}`,
        type: 'FeedBack',
        properties: { status: accuracyScore, notes: feedbackNotes, timestamp: new Date(Date.now() - 3600000 * 24 * 1).toISOString() }
      });

      this.relationships.push({
        id: `rel_${stockId}_feedback_${prevFeedbackId}`,
        source: stockId,
        target: prevFeedbackId,
        type: 'HAS_FEEDBACK',
        properties: { timestamp: new Date(Date.now() - 3600000 * 24 * 1).toISOString() }
      });
    });

    this.save();
    console.log("Successfully seeded demo data with historical causal chains & temporal feedback for Knowledge Graph!");
  }
}

