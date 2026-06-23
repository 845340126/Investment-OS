export interface GraphNode {
  id: string;
  label: string;
  type: 'Stock' | 'Signal' | 'MarketRegime';
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: 'HAS_SIGNAL' | 'IN_STATE';
  properties?: Record<string, any>;
}

export interface MarketData {
  volume: number;
  price_trend: 'up' | 'down' | 'flat';
  price: number;
  institutional_flow: number; // in Millions
  breakdown: boolean;
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
}
