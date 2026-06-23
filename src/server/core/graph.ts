import { MarketData, ProbabilisticTransition, ExecutionOrder } from '../../types';
import { tech_agent, fund_agent, sentiment_agent, opinion_agent } from './agents';
import { transitionWithArbiter } from '../state_machine/transitions';

interface GraphResult {
  signals: Record<string, any>;
  market_state: string;
  opinion: string;
  final_decision: string;
  execution_log: string[];
  probabilistic_transitions?: ProbabilisticTransition[];
  causal_pathways?: string[];
  debate_transcript?: string[];
  execution_plan?: ExecutionOrder;
}

/**
 * Simulates LangGraph orchestration behavior with a multi-agent feedback loop,
 * weighted consensus scoring, causal pathways tracking, execution broker routing,
 * multi-agent adversarial debate, and an active AI double-check/veto stage.
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

  log.push(`[${new Date().toISOString()}] 部署: 启动认知驱动 L3 级 Multi-Agent 决策流水线。`);
  log.push(`[初始化] 载入股票: ${symbol} | 初始状态: "${initialState}"`);

  // 1. Tech Agent with Confidence Score
  log.push(`[AI智能体] 激活 "技术趋势研判节点" (Technical-Agent)...`);
  const techRes = tech_agent(marketData);
  const techConfidence = marketData.price_trend === 'up' && marketData.volume > 1500000 ? 0.90 : 0.65;
  log.push(`[技术智能体] 探测指示: ${JSON.stringify(techRes.tech_signals)} | 精准度评分: ${(techConfidence * 100).toFixed(0)}%`);

  // 2. Fund Agent with Confidence Score
  log.push(`[AI智能体] 激活 "资金流向侦测节点" (Fund-Agent)...`);
  const fundRes = fund_agent(marketData);
  const fundConfidence = Math.abs(marketData.institutional_flow) > 15 ? 0.95 : 0.70;
  log.push(`[资金智能体] 探测指示: ${JSON.stringify(fundRes.fund_signals)} | 精准度评分: ${(fundConfidence * 100).toFixed(0)}%`);

  // 3. Sentiment Agent/Anomaly Detector with Confidence Score
  log.push(`[AI智能体] 激活 "情绪面异动监测节点" (Sentiment-Agent)...`);
  const sentimentRes = sentiment_agent(marketData);
  const sentimentConfidence = marketData.breakdown ? 0.98 : 0.60;
  log.push(`[情绪智能体] 探测指示: ${JSON.stringify(sentimentRes.sentiment_signals)} | 精准度评分: ${(sentimentConfidence * 100).toFixed(0)}%`);

  // 4. Combined Signals & Multi-agent consensus
  const mergedSignals = {
    ...techRes.tech_signals,
    ...fundRes.fund_signals,
    ...sentimentRes.sentiment_signals
  };
  const averageConfidence = (techConfidence + fundConfidence + sentimentConfidence) / 3;
  log.push(`[共识合并] 智能体群组协同置信度总阀指数: ${(averageConfidence * 100).toFixed(1)}%`);

  // 5. State Machine Transition Node (With Arbiter score logging and probabilistic state models)
  log.push(`[马尔可夫演化] 运行 "多分支概率回归状态机" 计算自适应转换机率...`);
  const transitionResult = transitionWithArbiter(initialState, mergedSignals);
  
  for (const arbLog of transitionResult.arbitrationLog) {
    log.push(arbLog);
  }
  
  const updatedState = transitionResult.nextState;
  const probs = transitionResult.probabilisticTransitions || [];
  
  log.push(`[概率矩阵输出] 候选状态流概率归一分布: ${probs.map(p => `${p.state}(${p.probability}%)`).join(', ')}`);

  // 6. Causal Pathways Resolution (Macro -> Flow -> Price -> State)
  log.push(`[因果推导] 基于图数据库关联因子链构建溯源通路 (Causal Attribution Graph)...`);
  const causalFactors = kgContext.filter(c => c.type === 'CausalFactor');
  let causalPathways: string[] = [];
  
  if (causalFactors.length > 0) {
    causalPathways = causalFactors.map((f, i) => {
      const typeLabel = f.properties?.factor_type || "MACRO_ENV";
      return `【阶段因果关联 ${i+1}】因 ${typeLabel} (${f.label}) ➔ 渗透至资金流/成交量波幅 ➔ 主导当前价格表现 ➔ 归宿至 ${updatedState} 阶段。`;
    });
  } else {
    causalPathways = [
      `【宏观资金因果】因 长期国债收益率/无风险利率重估 ➔ 指引核心高股息资产重估 ➔ 驱动大单流入 ➔ 铸就当前状态。`,
      `【微观流动因果】因 筹码在日线支撑箱体极致沉淀 ➔ 导致主升量能突破确认 ➔ 促发智能体多头共识。`
    ];
  }
  causalPathways.forEach(p => log.push(`[因果溯源链] ${p}`));

  // 7. Multi-Agent Adversarial Debate Panel (Hypothesis Generation)
  log.push(`[辩论对抗] 组建多智能体对战评议席（Multi-Agent Adversarial Debate）对抗校准特征...`);
  const debateTranscript: string[] = [];
  
  // Bulllish hypothesis
  debateTranscript.push(`🤖【技术面智能体 (Bullish Speculator)】：均线金叉结构已形成，多头排列迹象突出，放量突破是标准的起涨信号，我们应当大胆向最高胜率状态跟进！`);
  // Bearish hypothesis
  if (mergedSignals.fund_flow_negative) {
    debateTranscript.push(`🤖【资金面智能体 (Bearish Skeptic)】：等等！数据不会说谎，机构主力大单正在反向净流出达 $${Math.abs(marketData.institutional_flow)}M，这极有可能是高位诱多的“多头陷阱”，强烈警告不要盲目追涨！`);
    debateTranscript.push(`🤖【多维裁判节点 (Neutral Arbiter)】：根据两组高度冲突的信号，进行特征加权裁决！技术面强度得 40 分，资金净流出扣除权重。AI安全合规纠偏已强行介入，建议轻仓观望。`);
  } else {
    debateTranscript.push(`🤖【资金面智能体 (Cooperative Ally)】：大单流动方向与技术线突破方向完美谐振，大盘资金流入极佳，这是一次高质量的多头共识，没有异常偏差。`);
    debateTranscript.push(`🤖【情绪面智能体 (Sentiment Optimizer)】：市场空头阻力基本出清。未检测到核心破位风险。投机概率进一步调高。`);
  }
  debateTranscript.forEach(line => log.push(`[对抗辩论录] ${line}`));

  // 8. Execution Broker Protocol Generation (Execution & Scoring layer)
  log.push(`[执行内核] 生成高低阶策略路由与算法交易指令 (Execution Broker Routing)...`);
  let brokerAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let orderQty = 0;
  let limitPrice = marketData.price;
  let urgencyLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let routeMethod: 'VWAP' | 'TWAP' | 'DIRECT' = 'VWAP';
  let execRationale = "";

  if (updatedState === "BREAKOUT" || updatedState === "TREND_EXPANSION") {
    if (mergedSignals.fund_flow_negative) {
      brokerAction = 'HOLD';
      orderQty = 0;
      urgencyLevel = 'LOW';
      routeMethod = 'TWAP';
      execRationale = "探测到明显的技术与资金逆向分歧，执行引擎强制转换为挂单/持有观望，严控回撤风险。";
    } else {
      brokerAction = 'BUY';
      orderQty = 1500;
      limitPrice = parseFloat((marketData.price * 1.01).toFixed(2)); // slight premium for breakout entry
      urgencyLevel = 'HIGH';
      routeMethod = 'VWAP';
      execRationale = "多头共识无异动，利用成交量加权平摊策略（VWAP）火速切入起涨行情，锁定升势。";
    }
  } else if (updatedState === "DISTRIBUTION" || updatedState === "DECLINE") {
    brokerAction = 'SELL';
    orderQty = 2000;
    limitPrice = parseFloat((marketData.price * 0.99).toFixed(2));
    urgencyLevel = 'HIGH';
    routeMethod = 'DIRECT';
    execRationale = "触发派发或破位下行报警机制，优先执行无感滑点挂单离场交易，执行高阶防守策略。";
  } else {
    brokerAction = 'HOLD';
    orderQty = 500;
    limitPrice = marketData.price;
    urgencyLevel = 'LOW';
    routeMethod = 'TWAP';
    execRationale = "标的处于箱底静默定投或探低蓄力区间，适合在交易平稳段通过TWAP渐进式铺底。";
  }

  const executionPlan: ExecutionOrder = {
    action: brokerAction,
    quantity: orderQty,
    priceLimit: limitPrice,
    urgency: urgencyLevel,
    routeType: routeMethod,
    rationale: execRationale
  };
  log.push(`[交易控制指令] 执行动作: ${brokerAction} | 路由策略: ${routeMethod} | 挂单限价: $${limitPrice} | 策略理由: ${execRationale}`);

  // 9. AI Double-Check / Opinion Generator
  log.push(`[AI安全复核] 激活 AI 独立纠偏与综合研报撰写程序...`);
  let correctionWarning = "";
  if (updatedState === "BREAKOUT" && mergedSignals.fund_flow_negative) {
    correctionWarning = "【安全预警】技术形态向上突破，但是资金层面存在罕见的大额大单逆向撤退（流出超过 1000 万美元）。此行为表明盘口遭遇机构高位套现概率极大，请绝对避开市价追涨，防备庄家拉高派发。";
  }

  let opinion = await opinion_agent(symbol, updatedState, mergedSignals, kgContext);
  if (correctionWarning) {
    opinion = correctionWarning + "\n" + opinion;
  }
  log.push(`[分析终审] 专家大脑研报审核签发成功，报告包体共计 ${opinion.length} 字。`);

  // 10. Wrap everything up
  const finalDecision = `标的代码: ${symbol.toUpperCase()}\n当前现价: $${marketData.price}\n状态机阶段: ${updatedState}\n多维置信度指引: ${(averageConfidence * 100).toFixed(1)}%\n终审分析报告: ${opinion}`;
  log.push(`[${new Date().toISOString()}] 量化引擎一键决策研判流在 ${Date.now() - start} 毫秒内正常收敛。`);

  return {
    signals: mergedSignals,
    market_state: updatedState,
    opinion,
    final_decision: finalDecision,
    execution_log: log,
    probabilistic_transitions: probs,
    causal_pathways: causalPathways,
    debate_transcript: debateTranscript,
    execution_plan: executionPlan
  };
}
