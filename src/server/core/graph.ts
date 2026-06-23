import { MarketData } from '../../types';
import { tech_agent, fund_agent, sentiment_agent, opinion_agent } from './agents';
import { transitionWithArbiter } from '../state_machine/transitions';

interface GraphResult {
  signals: Record<string, any>;
  market_state: string;
  opinion: string;
  final_decision: string;
  execution_log: string[];
}

/**
 * Simulates LangGraph orchestration behavior with a multi-agent feedback loop,
 * weighted consensus scoring, and an active AI double-check (veto/verification) stage.
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

  // 1. Tech Agent with Confidence Score
  log.push(`[阶段] 启动 "技术分析智能体 (tech_agent)" 分析 K 线形态与均线指标...`);
  const techRes = tech_agent(marketData);
  // Introduce a mock/calculated confidence level based on indicator alignment
  const techConfidence = marketData.price_trend === 'up' && marketData.volume > 1500000 ? 0.90 : 0.65;
  log.push(`[技术智能体结果]: 信号=${JSON.stringify(techRes.tech_signals)} | 置信度=${(techConfidence * 100).toFixed(0)}%`);

  // 2. Fund Agent with Confidence Score
  log.push(`[阶段] 启动 "资金流向智能体 (fund_agent)" 分析机构大单与主动性交易情绪...`);
  const fundRes = fund_agent(marketData);
  const fundConfidence = Math.abs(marketData.institutional_flow) > 15 ? 0.95 : 0.70;
  log.push(`[资金智能体结果]: 信号=${JSON.stringify(fundRes.fund_signals)} | 置信度=${(fundConfidence * 100).toFixed(0)}%`);

  // 3. Sentiment Agent/Anomaly Detector with Confidence Score
  log.push(`[阶段] 启动 "情绪异常监测智能体 (sentiment_agent)" 寻找跌破与量能异常...`);
  const sentimentRes = sentiment_agent(marketData);
  const sentimentConfidence = marketData.breakdown ? 0.98 : 0.60;
  log.push(`[情绪智能体结果]: 信号=${JSON.stringify(sentimentRes.sentiment_signals)} | 置信度=${(sentimentConfidence * 100).toFixed(0)}%`);

  // 4. Cooperative Consensus Check (Multi-Agent Consensus Vote)
  log.push(`[阶段] 运行 "多维信号合并 (merge_signals)" 统一智能体特征矩阵特征...`);
  const mergedSignals = {
    ...techRes.tech_signals,
    ...fundRes.fund_signals,
    ...sentimentRes.sentiment_signals
  };
  
  // Calculate average weighted consensus confidence index
  const averageConfidence = (techConfidence + fundConfidence + sentimentConfidence) / 3;
  log.push(`[合并阶段完成] 协同置信度总阀指数: ${(averageConfidence * 100).toFixed(1)}%`);
  log.push(`[合并指示向量完成]: ${JSON.stringify(mergedSignals)}`);

  // 5. State Machine Transition Node (With Arbiter score logging)
  log.push(`[阶段] 运行 "状态机转移演算 (state_update)"：运行确定性与加权状态转移计算...`);
  const transitionResult = transitionWithArbiter(initialState, mergedSignals);
  
  // Appends state machine detailed scorecard and conflict resolution steps into log
  for (const arbLog of transitionResult.arbitrationLog) {
    log.push(arbLog);
  }
  
  let updatedState = transitionResult.nextState;

  // 6. Review & Double Check Stage (AI/Gemini Interactive Error Correction & Alignment)
  log.push(`[阶段] 触发 "智能体共识决策复核机制 (ai_validation_stage)"...`);
  // If the machine detects a breakout, but institutional flow is negative, AI should detect this contradiction
  let correctionWarning = "";
  if (updatedState === "BREAKOUT" && mergedSignals.fund_flow_negative) {
    correctionWarning = "【系统提示】检测到技术面出现量能突破，但机构资金呈现净流出状况。高度怀疑为“虚高出货”或“诱多假突破”。建议交易员保持轻仓，或将止损上提至突破起涨点。";
    log.push(`[AI安全复核警示] 检测到潜在矛盾偏离值: 股价技术突破但在资金层面有负向流出。智能意见已载入警告。`);
  } else {
    log.push(`[AI安全复核稳定] 状态转移矩阵与大单资金方向无显著逆向偏离。`);
  }

  // 7. Opinion Agent (AI / Gemini)
  log.push(`[阶段] 启动 "超脑研报终审智能体 (opinion_agent)" 调用大语言模型 Gemini 撰写决策综述与观点...`);
  let opinion = await opinion_agent(symbol, updatedState, mergedSignals, kgContext);
  
  if (correctionWarning) {
    opinion = correctionWarning + "\n" + opinion;
  }
  log.push(`[超脑研报] 决策意见书及安全复核评估撰写完毕，研报综述共 ${opinion.length} 字符。`);

  // 8. Final synthesis Node
  log.push(`[阶段] 启动 "终审信号输出 (final_decision)" 节点封装最终控制信号载荷...`);
  const finalDecision = `标的代码: ${symbol.toUpperCase()}\n当前现价: $${marketData.price}\n状态机阶段: ${updatedState}\n多维置信度指引: ${(averageConfidence * 100).toFixed(1)}%\n终审分析报告: ${opinion}`;
  log.push(`[${new Date().toISOString()}] 完成: 量化决策流水线分析成功，本次编排共运行 ${Date.now() - start} 毫秒。`);

  return {
    signals: mergedSignals,
    market_state: updatedState,
    opinion,
    final_decision: finalDecision,
    execution_log: log
  };
}
