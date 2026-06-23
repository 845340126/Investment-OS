export interface GraphNode {
  id: string;
  label: string;
  type: 'Stock' | 'Signal' | 'MarketRegime' | 'CausalFactor' | 'FeedBack';
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: 'HAS_SIGNAL' | 'IN_STATE' | 'CAUSED_BY' | 'HAS_FEEDBACK';
  properties?: Record<string, any>;
}

export interface MarketData {
  volume: number;
  price_trend: 'up' | 'down' | 'flat';
  price: number;
  institutional_flow: number; // in Millions
  breakdown: boolean;
}

export interface ExecutionOrder {
  action: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  priceLimit: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  routeType: 'VWAP' | 'TWAP' | 'DIRECT';
  rationale: string;
}

export interface ProbabilisticTransition {
  state: string;
  probability: number;
}

export interface InvestmentRunResult {
  symbol: string;
  query: string;
  market_data: MarketData;
  market_state: string;
  signals: Record<string, any>;
  opinions: string[];
  final_decision: string;
  timestamp: string;
  execution_log: string[];
  // NEW cognitive-driven metrics
  causal_pathways?: string[];
  probabilistic_transitions?: ProbabilisticTransition[];
  debate_transcript?: string[];
  execution_plan?: ExecutionOrder;
  memory_feedback?: {
    last_accuracy_status: string;
    anomaly_flagged: boolean;
    update_note: string;
  };
}
