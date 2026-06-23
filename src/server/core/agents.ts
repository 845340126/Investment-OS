import { GoogleGenAI } from '@google/genai';
import { InvestmentRunResult, MarketData } from '../../types';
import { Config } from '../config';

/**
 * Technical Analysis Agent Node
 */
export function tech_agent(marketData: MarketData): Record<string, any> {
  const signal = {
    volume_breakout: marketData.volume > 1500000,
    trend_confirmed: marketData.price_trend === 'up'
  };
  return { tech_signals: signal };
}

/**
 * Capital Flow Agent Node
 */
export function fund_agent(marketData: MarketData): Record<string, any> {
  const signal = {
    fund_flow_negative: marketData.institutional_flow < -10 // institutional outflow exceeding $10M
  };
  return { fund_signals: signal };
}

/**
 * Market Sentiment / Breakdown Agent Node
 */
export function sentiment_agent(marketData: MarketData): Record<string, any> {
  const signal = {
    breakdown: marketData.breakdown || marketData.price_trend === 'down'
  };
  return { sentiment_signals: signal };
}

/**
 * Intelligent Opinion Agent Node (Leveraging server-side Gemini flash)
 */
export async function opinion_agent(
  symbol: string,
  marketState: string,
  signals: Record<string, any>,
  kgContext: any[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "") {
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `
您是专业的量化投资专家，正在审查投资系统针对单个标的形成的机器综合特征：
股票标的/代码: ${symbol}
当前状态机市场阶段: ${marketState}
合并后决策信号量: ${JSON.stringify(signals)}
关联历史知识图谱上下文: ${JSON.stringify(kgContext)}

任务：基于上述量化和图谱输入，撰写一段100字级（不超过120字且请不要使用 markdown 加粗）的中文专业投资建议和市场分析意见。分析必须契合该资产当前所出的市场状态，语气需要专业、严谨、睿智、精炼。
      `;

      const response = await ai.models.generateContent({
        model: Config.LLM_MODEL,
        contents: prompt,
        config: {
          temperature: 0.3
        }
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (e) {
      console.error("Gemini API call failed, falling back to rule-based generator.", e);
    }
  }

  // Fallback Rule-based Opinion Generator
  let fallbackOpinion = "";
  if (marketState === "BREAKOUT") {
    fallbackOpinion = `[规则生成] ${symbol} 突破信号亮起。成交量放大(${signals.volume_breakout ? '是' : '否'})，当前大单流入显著，配合状态机突破，趋势形成初期建议逢低吸纳。`;
  } else if (marketState === "TREND_EXPANSION") {
    fallbackOpinion = `[规则生成] ${symbol} 处于趋势扩张期。技术均线多头排列，量能平稳分布。若资金流未转向，建议顺势持仓，止盈保护随斜率上移。`;
  } else if (marketState === "DISTRIBUTION") {
    fallbackOpinion = `[规则生成] ${symbol} 进入高位派发阶段。主力资金呈现净流出(${signals.fund_flow_negative ? '是' : '否'})，筹码结构松动。谨防高位诱多，建议减仓避险。`;
  } else if (marketState === "DECLINE") {
    fallbackOpinion = `[规则生成] ${symbol} 处于顺势衰退中。破位下行加剧，多头力量溃散。此时不宜盲目抄底，应保持现金仓位，耐心等待地价企稳及吸筹重置。`;
  } else {
    fallbackOpinion = `[规则生成] ${symbol} 目前处于吸筹整固期。日线震荡构筑箱体底，大机构在此区间默默洗盘。适合分批定投，静待成交量引爆突破箱体上沿。`;
  }

  return fallbackOpinion;
}
