export const STATES = [
  "ACCUMULATION",       // 吸筹
  "BREAKOUT",           // 突破
  "TREND_EXPANSION",    // 趋势扩张
  "DISTRIBUTION",       // 派发
  "DECLINE",            // 衰退
  "REVERSAL"            // 反转
];

/**
 * Executes a deterministic state transition based on technical & fundamental signals
 */
export function transition(currentState: string, signals: Record<string, any>): string {
  const state = (currentState || "ACCUMULATION").toUpperCase();

  switch (state) {
    case "ACCUMULATION":
      if (signals.volume_breakout) {
        return "BREAKOUT";
      }
      break;

    case "BREAKOUT":
      if (signals.trend_confirmed) {
        return "TREND_EXPANSION";
      }
      if (signals.breakdown) {
        return "DECLINE";
      }
      break;

    case "TREND_EXPANSION":
      if (signals.fund_flow_negative) {
        return "DISTRIBUTION";
      }
      if (signals.breakdown) {
        return "DECLINE";
      }
      break;

    case "DISTRIBUTION":
      if (signals.breakdown) {
        return "DECLINE";
      }
      if (signals.trend_confirmed && !signals.fund_flow_negative) {
        return "TREND_EXPANSION";
      }
      break;

    case "DECLINE":
      // Re-accumulation occurs when volume increases on low or stabilized prices
      if (signals.volume_breakout && !signals.breakdown) {
        return "ACCUMULATION";
      }
      break;

    case "REVERSAL":
      if (signals.trend_confirmed) {
        return "BREAKOUT";
      }
      break;
  }

  return state;
}
