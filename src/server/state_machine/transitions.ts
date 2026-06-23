export const STATES = [
  "ACCUMULATION",       // 吸筹期
  "BREAKOUT",           // 突破期
  "TREND_EXPANSION",    // 多头主升段
  "DISTRIBUTION",       // 派发期
  "DECLINE",            // 衰退期
  "REVERSAL"            // 反转期
];

export interface TransitionExplanation {
  nextState: string;
  scoreCard: Record<string, number>;
  arbitrationLog: string[];
}

/**
 * Executes a weighted, deterministic state transition based on technical & fundamental signals
 * Resolve conflicts (e.g. volume breakout vs. breakdown) using assigning specific priorities.
 */
export function transitionWithArbiter(currentState: string, signals: Record<string, any>): TransitionExplanation {
  const state = (currentState || "ACCUMULATION").toUpperCase();
  const logs: string[] = [];
  
  // Assign priority weights & verify indicators
  // Positive parameters
  let bullishWeight = 0;
  if (signals.volume_breakout) bullishWeight += 40;
  if (signals.trend_confirmed) bullishWeight += 30;
  
  // Negative parameters
  let bearishWeight = 0;
  if (signals.breakdown) bearishWeight += 50;
  if (signals.fund_flow_negative) bearishWeight += 35;

  logs.push(`[状态判定机] 计算综合加权：多头指标得分 [${bullishWeight}]，空头指标得分 [${bearishWeight}]。`);

  let nextState = state;

  switch (state) {
    case "ACCUMULATION":
      // Requiement for BREAKOUT: strong bullish score >= 40 and no bearish breakdown veto
      if (signals.volume_breakout) {
        if (signals.breakdown) {
          logs.push(`[冲突仲裁] 检测到突破信号存在，但伴随关键支撑破位(breakdown Veto)，判定为“震荡假突破”，维持原有 [ACCUMULATION] 状态不变。`);
        } else {
          nextState = "BREAKOUT";
          logs.push(`[状态转移] 多头能量通过筛选！触发状态转换条件 ➔ 水平突破确认 [BREAKOUT]。`);
        }
      }
      break;

    case "BREAKOUT":
      if (signals.breakdown) {
        nextState = "DECLINE";
        logs.push(`[状态转移] 突破后剧烈破位！空头特征占优 (得分: ${bearishWeight})，判定突破失败，转入衰退状态 [DECLINE]。`);
      } else if (signals.trend_confirmed && bullishWeight >= 70) {
        nextState = "TREND_EXPANSION";
        logs.push(`[状态转移] 双重技术指标与均线确认，多头优势显著 (牛市能量: ${bullishWeight})，顺利挺进主升段 [TREND_EXPANSION]。`);
      }
      break;

    case "TREND_EXPANSION":
      // If breakdown occurs, crash straight to Decline.
      // If fund flow represents systematic delivery, transition to high-level spot distribution.
      if (signals.breakdown) {
        nextState = "DECLINE";
        logs.push(`[状态转移] 剧烈跌破趋势均线支撑！直接转向深幅调整 [DECLINE]。`);
      } else if (signals.fund_flow_negative && bearishWeight >= 35) {
        nextState = "DISTRIBUTION";
        logs.push(`[状态转移] 趋势段观测到大量机构资金撤离(大单净流出: ${signals.fund_flow_negative})，警惕筹码松动，转换至高位派发状态 [DISTRIBUTION]。`);
      }
      break;

    case "DISTRIBUTION":
      if (signals.breakdown) {
        nextState = "DECLINE";
        logs.push(`[状态转移] 高位震荡彻底泄洪，向下跌破核心密集成交区，转入崩溃通道 [DECLINE]。`);
      } else if (signals.trend_confirmed && !signals.fund_flow_negative && bullishWeight >= 50) {
        nextState = "TREND_EXPANSION";
        logs.push(`[状态转移] 筹码完成次级重洗，主力资金回流，向上修补重拾主升走势 [TREND_EXPANSION]。`);
      }
      break;

    case "DECLINE":
      // Volume breakout on stabilizing prices restarts Accumulation, preventing deathloop.
      if (signals.volume_breakout && !signals.breakdown) {
        nextState = "ACCUMULATION";
        logs.push(`[状态转移] 恐慌抛售衰退完毕，低价位处出现明显的放量吸筹特征(抄底盘形成)，引导至吸筹整固期 [ACCUMULATION]。`);
      }
      break;

    case "REVERSAL":
      if (signals.trend_confirmed) {
        nextState = "BREAKOUT";
        logs.push(`[状态转移] 箱体底部双底反转金叉确认，重上阻力位 [BREAKOUT]。`);
      }
      break;
  }

  // Double check self loops safety parameters
  if (nextState === state) {
    logs.push(`[稳态判定] 无高级阶段跃迁跳转条件触发。维持现有稳态: "${state}"。`);
  }

  return {
    nextState,
    scoreCard: { bullishWeight, bearishWeight },
    arbitrationLog: logs
  };
}

/**
 * Compatible with legacy transition
 */
export function transition(currentState: string, signals: Record<string, any>): string {
  return transitionWithArbiter(currentState, signals).nextState;
}
