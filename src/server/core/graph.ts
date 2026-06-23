import { MarketData } from '../../types';
import { tech_agent, fund_agent, sentiment_agent, opinion_agent } from './agents';
import { transition } from '../state_machine/transitions';

interface GraphResult {
  signals: Record<string, any>;
  market_state: string;
  opinion: string;
  final_decision: string;
  execution_log: string[];
}

/**
 * Simulates LangGraph orchestration behavior in a linear pipeline with robust audit tracing.
 */
export async function run_graph(
  symbol: string,
  query: string,
  marketData: MarketData,
  initialState: string,
  kgContext: any[]
): Promise<GraphResult> {
  const log: string[] = [];
  const start = Date.now();

  log.push(`[${new Date().toISOString()}] 启动: 正在为标的 ${symbol} 初始化量化内核智能体决策流水线。`);
  log.push(`[系统] 从图数据库加载的当前市场周期初态: "${initialState}"。`);

  // 1. Tech Agent
  log.push(`[阶段] 启动 "技术分析智能体 (tech_agent)" 分析 K 线形态与均线指标...`);
  const techRes = tech_agent(marketData);
  log.push(`[技术智能体信号生成]: ${JSON.stringify(techRes.tech_signals)}`);

  // 2. Fund Agent
  log.push(`[阶段] 启动 "资金流向智能体 (fund_agent)" 分析机构大单与主动性交易情绪...`);
  const fundRes = fund_agent(marketData);
  log.push(`[资金智能体信号生成]: ${JSON.stringify(fundRes.fund_signals)}`);

  // 3. Sentiment Agent
  log.push(`[阶段] 启动 "情绪异常监测智能体 (sentiment_agent)" 寻找跌破与量能异常...`);
  const sentimentRes = sentiment_agent(marketData);
  log.push(`[情绪智能体信号生成]: ${JSON.stringify(sentimentRes.sentiment_signals)}`);

  // 4. Merge Node
  log.push(`[阶段] 运行 "多维信号合并 (merge_signals)" 统一智能体特征矩阵特征...`);
  const mergedSignals = {
    ...techRes.tech_signals,
    ...fundRes.fund_signals,
    ...sentimentRes.sentiment_signals
  };
  log.push(`[合并指示向量完成]: ${JSON.stringify(mergedSignals)}`);

  // 5. State Machine Transition Node
  log.push(`[阶段] 运行 "状态机转移演算 (state_update)"：运行确定性时序跳转计算...`);
  const updatedState = transition(initialState, mergedSignals);
  if (updatedState !== initialState) {
    log.push(`[状态更新] 检测到状态转移触发条件：周期阶段自 "${initialState}" ➔ 成功转移至 "${updatedState}"。`);
  } else {
    log.push(`[状态更新] 未触发阶段跃迁：本分析周期内价格特征安全稳定在原有状态 "${initialState}"。`);
  }

  // 6. Opinion Agent (AI / Gemini)
  log.push(`[阶段] 启动 "超脑研报终审智能体 (opinion_agent)" 调用大语言模型 Gemini 撰写决策综述与观点...`);
  const opinion = await opinion_agent(symbol, updatedState, mergedSignals, kgContext);
  log.push(`[超脑研报] 决策意见书撰写完毕，研报综述共 ${opinion.length} 字符。`);

  // 7. Final synthesis Node
  log.push(`[阶段] 启动 "终审信号输出 (final_decision)" 节点封装最终控制信号载荷...`);
  const finalDecision = `标的代码: ${symbol.toUpperCase()}\n当前现价: $${marketData.price}\n状态机阶段: ${updatedState}\n终审分析报告: ${opinion}`;
  log.push(`[${new Date().toISOString()}] 完成: 量化决策流水线分析成功，本次编排共运行 ${Date.now() - start} 毫秒。`);

  return {
    signals: mergedSignals,
    market_state: updatedState,
    opinion,
    final_decision: finalDecision,
    execution_log: log
  };
}
