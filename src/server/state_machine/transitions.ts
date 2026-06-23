export const STATES = [
  "ACCUMULATION",       // 吸筹期
  "BREAKOUT",           // 突破期
  "TREND_EXPANSION",    // 多头主升段
  "DISTRIBUTION",       // 派发期
  "DECLINE",            // 衰退期
  "REVERSAL"            // 反转期
];

import { ProbabilisticTransition } from '../../types';

export interface TransitionExplanation {
  nextState: string;
  scoreCard: Record<string, number>;
  arbitrationLog: string[];
  probabilisticTransitions?: ProbabilisticTransition[];
}

/**
 * Computes a standard Markov-based dynamic transition probability layout for all states
 */
export function calculateTransitionProbabilities(
  currentState: string,
  bullishWeight: number,
  bearishWeight: number,
  signals: Record<string, any>
): ProbabilisticTransition[] {
  const state = (currentState || "ACCUMULATION").toUpperCase();
  const probabilities: Record<string, number> = {
    "ACCUMULATION": 0,
    "BREAKOUT": 0,
    "TREND_EXPANSION": 0,
    "DISTRIBUTION": 0,
    "DECLINE": 0
  };

  // Base transition probability distributions with standard state-machine bias
  switch (state) {
    case "ACCUMULATION":
      if (signals.volume_breakout && !signals.breakdown) {
        probabilities["BREAKOUT"] = 70;
        probabilities["ACCUMULATION"] = 25;
        probabilities["DECLINE"] = 5;
      } else if (signals.breakdown) {
        probabilities["DECLINE"] = 60;
        probabilities["ACCUMULATION"] = 40;
      } else {
        probabilities["ACCUMULATION"] = 85;
        probabilities["BREAKOUT"] = 10;
        probabilities["DECLINE"] = 5;
      }
      break;

    case "BREAKOUT":
      if (signals.breakdown) {
        probabilities["DECLINE"] = 80;
        probabilities["BREAKOUT"] = 10;
        probabilities["ACCUMULATION"] = 10;
      } else {
        probabilities["TREND_EXPANSION"] = 65;
        probabilities["BREAKOUT"] = 25;
        probabilities["DECLINE"] = 10;
      }
      break;

    case "TREND_EXPANSION":
      if (signals.breakdown) {
        probabilities["DECLINE"] = 85;
        probabilities["TREND_EXPANSION"] = 15;
      } else if (signals.fund_flow_negative) {
        probabilities["DISTRIBUTION"] = 75;
        probabilities["TREND_EXPANSION"] = 20;
        probabilities["DECLINE"] = 5;
      } else {
        probabilities["TREND_EXPANSION"] = 80;
        probabilities["DISTRIBUTION"] = 15;
        probabilities["DECLINE"] = 5;
      }
      break;

    case "DISTRIBUTION":
      if (signals.breakdown) {
        probabilities["DECLINE"] = 90;
        probabilities["DISTRIBUTION"] = 10;
      } else if (signals.volume_breakout && !signals.fund_flow_negative) {
        probabilities["TREND_EXPANSION"] = 60;
        probabilities["DISTRIBUTION"] = 35;
        probabilities["DECLINE"] = 5;
      } else {
        probabilities["DISTRIBUTION"] = 70;
        probabilities["DECLINE"] = 25;
        probabilities["TREND_EXPANSION"] = 5;
      }
      break;

    case "DECLINE":
    default:
      if (signals.volume_breakout && !signals.breakdown) {
        probabilities["ACCUMULATION"] = 65;
        probabilities["DECLINE"] = 30;
        probabilities["BREAKOUT"] = 5;
      } else {
        probabilities["DECLINE"] = 85;
        probabilities["ACCUMULATION"] = 15;
      }
      break;
  }

  // Adjust probabilities dynamically using raw bull/bear indicators
  const adjBull = bullishWeight / 100;
  const adjBear = bearishWeight / 100;

  if (probabilities["BREAKOUT"] !== undefined) {
    probabilities["BREAKOUT"] = Math.max(0, probabilities["BREAKOUT"] + (adjBull * 15) - (adjBear * 10));
  }
  if (probabilities["TREND_EXPANSION"] !== undefined) {
    probabilities["TREND_EXPANSION"] = Math.max(0, probabilities["TREND_EXPANSION"] + (adjBull * 20) - (adjBear * 15));
  }
  if (probabilities["DECLINE"] !== undefined) {
    probabilities["DECLINE"] = Math.max(0, probabilities["DECLINE"] + (adjBear * 25) - (adjBull * 15));
  }

  // Smooth & Normalize to 100%
  const total = Object.values(probabilities).reduce((sum, v) => sum + v, 0);
  return Object.entries(probabilities).map(([st, val]) => {
    return {
      state: st,
      probability: parseFloat(((val / total) * 100).toFixed(1))
    };
  }).sort((a, b) => b.probability - a.probability);
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

  logs.push(`[状态预测机] 计算综合加权：多头得分 [${bullishWeight}]，空头得分 [${bearishWeight}]。`);

  let nextState = state;

  switch (state) {
    case "ACCUMULATION":
      // Requirement for BREAKOUT: strong bullish score >= 40 and no bearish breakdown veto
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
        logs.push(`[状态转移] 高位震荡彻底泄洪，向下跌破核心密密集区，转入崩溃通道 [DECLINE]。`);
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
    logs.push(`[稳态稳健] 无最高优先跳转转移触发，回归主循环。维持现有状态: "${state}"。`);
  }

  const probabilisticTransitions = calculateTransitionProbabilities(state, bullishWeight, bearishWeight, signals);

  return {
    nextState,
    scoreCard: { bullishWeight, bearishWeight },
    arbitrationLog: logs,
    probabilisticTransitions
  };
}

/**
 * Compatible with legacy transition
 */
export function transition(currentState: string, signals: Record<string, any>): string {
  return transitionWithArbiter(currentState, signals).nextState;
}
