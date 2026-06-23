import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, 
  Database, 
  Network, 
  ArrowRight, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  BarChart3, 
  Info, 
  Sparkles, 
  Check, 
  Activity, 
  FileText, 
  Terminal, 
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Orbit
} from 'lucide-react';
import { GraphNode, GraphRelationship, MarketData, InvestmentRunResult } from './types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const LOCALIZATION_MAP: Record<string, string> = {
  // States
  'ACCUMULATION': '主力吸筹期',
  'BREAKOUT': '放量突破区',
  'TREND_EXPANSION': '趋势主升浪',
  'DISTRIBUTION': '高位派发期',
  'DECLINE': '下行衰退期',

  // Signals
  'volume_breakout': '技术量能突破',
  'trend_confirmed': '均线金叉支撑',
  'fund_flow_negative': '资金大单流出',
  'breakdown': '破位关键支撑'
};

const getLocalizedNodeLabel = (node: any) => {
  if (!node) return '';
  if (node.type === 'Stock') {
    return node.label;
  }
  if (node.type === 'MarketRegime') {
    const s = node.properties?.state || '';
    return LOCALIZATION_MAP[s] || `周期阶段: ${s}`;
  }
  if (node.type === 'Signal') {
    const t = node.properties?.type || '';
    const localizedType = LOCALIZATION_MAP[t] || t;
    const v = node.properties?.value;
    const strVal = v === true ? '是' : (v === false ? '否' : JSON.stringify(v));
    return `${localizedType}: ${strVal}`;
  }
  return node.label;
};

const generateSevenDayHistory = (currentPrice: number, trend: string, symbol: string) => {
  const history = [];
  const today = new Date();
  
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i);
  }

  const pseudoRandom = (step: number) => {
    const x = Math.sin(seed + step + 5.12) * 10000;
    return x - Math.floor(x);
  };

  let trendDirectionFactor = 0;
  if (trend === 'up') {
    trendDirectionFactor = -1.2;
  } else if (trend === 'down') {
    trendDirectionFactor = 1.2;
  }

  const prices: number[] = new Array(7);
  prices[6] = currentPrice;

  for (let i = 5; i >= 0; i--) {
    const randComponent = (pseudoRandom(i) * 3.4 - 1.7);
    const changePct = randComponent + trendDirectionFactor;
    prices[i] = parseFloat((prices[i + 1] / (1 + changePct / 100)).toFixed(2));
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - (6 - i));
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    history.push({
      date: label,
      Price: prices[i]
    });
  }
  return history;
};

export default function App() {
  // Config & Inputs state
  const [symbol, setSymbol] = useState<string>('600519');
  const [stockName, setStockName] = useState<string>('贵州茅台');
  const [recentStocks, setRecentStocks] = useState<Array<{ symbol: string; name: string }>>(() => {
    try {
      const saved = localStorage.getItem('recent_stocks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load recent stocks', e);
    }
    return [
      { symbol: '600519', name: '贵州茅台' },
      { symbol: '000002', name: '万科A' },
      { symbol: '300750', name: '宁德时代' },
      { symbol: '601318', name: '中国平安' }
    ];
  });
  const [query, setQuery] = useState<string>('当前是否已成功放量突破阻力位？');
  const [price, setPrice] = useState<number>(1720.50);
  const [volume, setVolume] = useState<number>(1530000);
  const [priceTrend, setPriceTrend] = useState<'up' | 'down' | 'flat'>('up');
  const [institutionalFlow, setInstitutionalFlow] = useState<number>(45.2);
  const [breakdown, setBreakdown] = useState<boolean>(false);

  // Application Data state
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; relationships: GraphRelationship[] }>({
    nodes: [],
    relationships: []
  });
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<InvestmentRunResult | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<string>('opinion');
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [systemTime, setSystemTime] = useState<string>('');
  const [isGraphFullscreen, setIsGraphFullscreen] = useState<boolean>(false);
  const [relationFilter, setRelationFilter] = useState<string>('ALL');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [layoutMode, setLayoutMode] = useState<'orbit' | 'force'>('orbit');
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    // Zoom sensitivity scale
    const zoomIntensity = 0.04;
    let nextScale = zoomScale + (e.deltaY < 0 ? zoomIntensity : -zoomIntensity);
    nextScale = Math.max(0.3, Math.min(nextScale, 3.0));
    setZoomScale(nextScale);
  };

  // Settle current system clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.getUTCFullYear() + '-' + 
        String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getUTCDate()).padStart(2, '0') + ' ' + 
        String(now.getUTCHours()).padStart(2, '0') + ':' + 
        String(now.getUTCMinutes()).padStart(2, '0') + ':' + 
        String(now.getUTCSeconds()).padStart(2, '0') + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch graph & indices on startup
  useEffect(() => {
    fetchGraph();
    fetchBrokerData('600519');
  }, []);

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/graph');
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.error("Failed to load Knowledge Graph metrics", e);
    }
  };

  const fetchBrokerData = async (targetSymbol: string) => {
    try {
      const res = await fetch(`/api/broker/indicators/${targetSymbol}`);
      if (res.ok) {
        const data: MarketData & { name?: string } = await res.json();
        setPrice(data.price);
        setVolume(data.volume);
        setPriceTrend(data.price_trend);
        setInstitutionalFlow(data.institutional_flow);
        setBreakdown(data.breakdown);
        if (data.name) {
          setStockName(data.name);
          
          // Dynamically append newly synced symbol to recent list
          const cleanSymbol = targetSymbol.toUpperCase().trim();
          setRecentStocks((prev) => {
            const filtered = prev.filter(x => x.symbol !== cleanSymbol);
            const updated = [{ symbol: cleanSymbol, name: data.name || cleanSymbol }, ...filtered].slice(0, 5);
            try {
              localStorage.setItem('recent_stocks', JSON.stringify(updated));
            } catch (err) {}
            return updated;
          });
        }
        // Force the visual Knowledge Graph network to query newest additions
        await fetchGraph();
      }
    } catch (e) {
      console.error("Failed to load indicators from broker", e);
    }
  };

  const handleSymbolChange = (sym: string) => {
    setSymbol(sym);
    fetchBrokerData(sym);
  };

  const runPipeline = async () => {
    setIsLoading(true);
    setRunResult(null);
    setExecutionLogs([
      `[系统] 正在连接数据代理及 JCP Broker 以获取最新市场报价...`,
      `[系统] 正在准备量化特征矩阵并向后端智能体发送推理请求...`
    ]);

    const payload = {
      symbol: symbol.toUpperCase(),
      query,
      market_data: {
        price,
        volume,
        price_trend: priceTrend,
        institutional_flow: institutionalFlow,
        breakdown
      }
    };

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result: InvestmentRunResult = await res.json();
        setRunResult(result);
        setExecutionLogs(result.execution_log);
        // Refresh full graph to show newly added nodes & edges
        await fetchGraph();
      } else {
        const err = await res.json();
        setExecutionLogs(prev => [...prev, `[错误] 后端执行失败: ${err.error || '未知错误'}`]);
      }
    } catch (e) {
      setExecutionLogs(prev => [...prev, `[错误] 连接服务端异常: ${(e as Error).message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetDatabase = async () => {
    if (!window.confirm("您确定要清空并把知识图谱重新置为出厂默认的演示数据集吗？")) {
      return;
    }
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGraphData(data.graph);
        setRunResult(null);
        setSelectedNode(null);
        setExecutionLogs([`[系统] 知识图谱已清空，并成功重新填充 AAPL, TSLA, NVDA 和 BTC 的核心节点与关系。`]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // SVG Helper layout coordinates logic for visual Graph
  const computeGraphPositions = (gData: typeof graphData, w: number, h: number = 280, layoutType: 'orbit' | 'force' = 'orbit') => {
    const stockNodes = gData.nodes.filter(n => n.type === 'Stock');
    const signalNodes = gData.nodes.filter(n => n.type === 'Signal');

    const coords: Record<string, { x: number; y: number }> = {};

    if (layoutType === 'orbit') {
      // Stock Nodes placed center horizontal orbital spacing
      stockNodes.forEach((node, idx) => {
        const totalStocks = stockNodes.length;
        const spacingX = w / (totalStocks + 1);
        coords[node.id] = {
          x: spacingX * (idx + 1),
          y: h / 2
        };
      });

      // Orbit coordinates around their parent Stock
      gData.relationships.forEach((rel) => {
        const sourcePt = coords[rel.source];
        if (!sourcePt) return;

        const targetNode = gData.nodes.find(n => n.id === rel.target);
        if (!targetNode) return;

        if (!coords[targetNode.id]) {
          // Stagger positions in orbits based on target types
          if (targetNode.type === 'MarketRegime') {
            coords[targetNode.id] = {
              x: sourcePt.x,
              y: sourcePt.y - 75 // Regime straight above
            };
          } else {
            // Signals arranged in circular array around stock
            const sIndex = signalNodes.indexOf(targetNode);
            const angle = (sIndex * (360 / Math.max(1, signalNodes.length)) * Math.PI) / 180;
            const radius = 65;
            coords[targetNode.id] = {
              x: sourcePt.x + radius * Math.cos(angle + (stockNodes.indexOf(
                stockNodes.find(s => s.id === rel.source) || stockNodes[0]
              ) * 45)),
              y: sourcePt.y + radius * Math.sin(angle) * 0.95 + 15
            };
          }
        }
      });

      return coords;
    } else {
      // Force-directed layout
      const nodes = gData.nodes;
      const numNodes = nodes.length;
      if (numNodes === 0) return {};

      // Deterministic pseudo-random offset based on ID to avoid dynamic jumps on render
      const getDeterministicOffset = (id: string, seed: number) => {
        let hash = seed;
        for (let i = 0; i < id.length; i++) {
          hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return (Math.abs(hash) % 1000) / 1000;
      };

      const tempCoords: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        const angle = getDeterministicOffset(node.id, 7) * Math.PI * 2;
        const r = 40 + getDeterministicOffset(node.id, 13) * 80;
        tempCoords[node.id] = {
          x: w / 2 + r * Math.cos(angle),
          y: h / 2 + r * Math.sin(angle)
        };
      });

      const k = Math.sqrt((w * h) / Math.max(1, numNodes)) * 0.85; // Ideal edge length

      // Run force calculation loop (e.g., 100 iterations)
      for (let iter = 0; iter < 100; iter++) {
        const forces: Record<string, { x: number; y: number }> = {};
        nodes.forEach(n => {
          forces[n.id] = { x: 0, y: 0 };
        });

        // 1. Repulsive forces among all nodes
        for (let i = 0; i < numNodes; i++) {
          const u = nodes[i];
          for (let j = i + 1; j < numNodes; j++) {
            const v = nodes[j];
            const dx = tempCoords[u.id].x - tempCoords[v.id].x;
            const dy = tempCoords[u.id].y - tempCoords[v.id].y;
            const distSq = dx * dx + dy * dy + 0.01;
            const dist = Math.sqrt(distSq);

            if (dist < 250) {
              const force = (k * k) / dist;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              forces[u.id].x += fx;
              forces[u.id].y += fy;
              forces[v.id].x -= fx;
              forces[v.id].y -= fy;
            }
          }
        }

        // 2. Attractive forces along relationships
        gData.relationships.forEach(rel => {
          const u = rel.source;
          const v = rel.target;
          if (!tempCoords[u] || !tempCoords[v]) return;

          const dx = tempCoords[u].x - tempCoords[v].x;
          const dy = tempCoords[u].y - tempCoords[v].y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

          const force = (dist * dist) / k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          forces[u].x -= fx;
          forces[u].y -= fy;
          forces[v].x += fx;
          forces[v].y += fy;
        });

        // 3. Apply displacement with gravity/centering force and constraints
        const gravity = 0.05;
        const temp = Math.max(0.1, 1 - iter / 100);
        nodes.forEach(n => {
          const pos = tempCoords[n.id];
          const f = forces[n.id];

          let dx = f.x * 0.15 * temp;
          let dy = f.y * 0.15 * temp;

          // Weak gravity pull to the center to prevent isolation
          dx += (w / 2 - pos.x) * gravity;
          dy += (h / 2 - pos.y) * gravity;

          const step = Math.sqrt(dx * dx + dy * dy);
          if (step > 35) {
            dx = (dx / step) * 35;
            dy = (dy / step) * 35;
          }

          pos.x += dx;
          pos.y += dy;

          // SVG visual constraints
          pos.x = Math.max(40, Math.min(w - 40, pos.x));
          pos.y = Math.max(40, Math.min(h - 40, pos.y));
        });
      }

      return tempCoords;
    }
  };

  const getDisplayGraphData = () => {
    if (!filterActiveOnly) {
      return graphData;
    }
    const currentUpper = symbol.toUpperCase().trim();
    const activeStockNode = graphData.nodes.find(
      n => n.type === 'Stock' && n.properties?.symbol === currentUpper
    );
    if (!activeStockNode) {
      return { nodes: [], relationships: [] };
    }
    const activeRels = graphData.relationships.filter(
      r => r.source === activeStockNode.id || r.target === activeStockNode.id
    );
    const activeNodeIds = new Set<string>();
    activeNodeIds.add(activeStockNode.id);
    activeRels.forEach(r => {
      activeNodeIds.add(r.source);
      activeNodeIds.add(r.target);
    });
    const activeNodes = graphData.nodes.filter(n => activeNodeIds.has(n.id));
    return {
      nodes: activeNodes,
      relationships: activeRels
    };
  };

  const displayGraphData = getDisplayGraphData();
  const filteredRelationships = useMemo(() => {
    return displayGraphData.relationships.filter(
      rel => relationFilter === 'ALL' || rel.type === relationFilter
    );
  }, [displayGraphData.relationships, relationFilter]);

  const activeFilteredNodeIds = useMemo(() => {
    if (relationFilter === 'ALL') return null;
    const ids = new Set<string>();
    filteredRelationships.forEach(rel => {
      ids.add(rel.source);
      ids.add(rel.target);
    });
    return ids;
  }, [filteredRelationships, relationFilter]);

  const stockNodesCount = displayGraphData.nodes.filter(n => n.type === 'Stock').length;
  const svgHeight = isGraphFullscreen ? 520 : 280;
  const svgWidth = isGraphFullscreen 
    ? Math.max(1200, stockNodesCount * 240) 
    : Math.max(620, stockNodesCount * 175);
  const positions = useMemo(() => {
    return computeGraphPositions(displayGraphData, svgWidth, svgHeight, layoutMode);
  }, [displayGraphData, svgWidth, svgHeight, layoutMode]);

  // Helper colors for state machine steps
  const statesFlow = [
    { key: "ACCUMULATION", label: "主力吸筹期 (ACCUMULATION)", desc: "主力震荡洗盘吸筹期 (吸筹)" },
    { key: "BREAKOUT", label: "放量突破区 (BREAKOUT)", desc: "放量向上突破震荡阻力 (突破)" },
    { key: "TREND_EXPANSION", label: "趋势主升浪 (TREND EXPANSION)", desc: "主升浪多头动能扩张 (多头)" },
    { key: "DISTRIBUTION", label: "高位派发期 (DISTRIBUTION)", desc: "筹码高位松动派发出货 (派发)" },
    { key: "DECLINE", label: "下行衰退期 (DECLINE)", desc: "顺势向下调整跌破支撑 (衰退)" }
  ];

  const getRegimeColor = (state: string) => {
    switch (state?.toUpperCase()) {
      case 'ACCUMULATION': return 'border-amber-500/30 text-amber-400 bg-amber-950/10 shadow-amber-500/5';
      case 'BREAKOUT': return 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20 shadow-emerald-500/10';
      case 'TREND_EXPANSION': return 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20 shadow-cyan-500/10';
      case 'DISTRIBUTION': return 'border-orange-500/30 text-orange-400 bg-orange-950/10 shadow-orange-500/5';
      case 'DECLINE': return 'border-rose-500/40 text-rose-400 bg-rose-950/20 shadow-rose-500/10';
      default: return 'border-neutral-700/55 text-neutral-400 bg-neutral-900/10';
    }
  };

  const activeStateKey = runResult?.market_state || 
    (graphData.nodes.find(n => n.type === 'Stock' && n.properties?.symbol === symbol.toUpperCase()) ? 
      (() => {
        const stockNode = graphData.nodes.find(n => n.type === 'Stock' && n.properties?.symbol === symbol.toUpperCase());
        const rels = graphData.relationships.filter(r => r.source === stockNode?.id && r.type === 'IN_STATE');
        if (rels.length > 0) {
          const target = graphData.nodes.find(n => n.id === rels[rels.length - 1].target);
          return target?.properties?.state;
        }
        return 'ACCUMULATION';
      })() : 'ACCUMULATION');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-orange-500/30">
      
      {/* 顶部状态栏 */}
      <header className="border-b border-neutral-900 bg-neutral-950 px-5 py-3 flex flex-wrap items-center justify-between shadow-2xl z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-orange-600/90 flex items-center justify-center border border-orange-500 shadow-lg shadow-orange-600/20 animate-pulse">
            <Cpu className="w-4 h-4 text-orange-100" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-neutral-100">量化投资时序研判系统</h1>
            <p className="text-[10px] font-mono text-neutral-500">量化内核决策操作系统 V1.0.0</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono bg-neutral-900/55 px-3 py-1.5 rounded-md border border-neutral-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-400 font-semibold">决策引擎在线</span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">服务端口: 3000</span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono text-neutral-400 bg-neutral-900/55 px-2.5 py-1.5 rounded-md border border-neutral-800">
            <Clock className="w-3.5 h-3.5 text-orange-500/80" />
            <span>{systemTime || '2026-06-22 UTC'}</span>
          </div>

          <button 
            type="button"
            onClick={resetDatabase}
            className="flex items-center space-x-1.5 text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 py-1.5 px-3 rounded-md border border-neutral-800 transition-all text-neutral-300"
            title="一键擦除并重建默认示例数据集"
          >
            <RefreshCw className="w-3 h-3 text-orange-500" />
            <span>重建图谱数据</span>
          </button>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0">
        
        {/* 左侧：量化特征控制器 */}
        <div className={`${isGraphFullscreen ? 'hidden' : 'lg:col-span-3 flex flex-col space-y-4'}`}>
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-5 flex flex-col space-y-4 shadow-xl relative overflow-hidden backdrop-blur-sm self-start w-full">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-600" />
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">决策参数配置栏</h3>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-500/70" />
            </div>

            {/* 快速选择 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-medium">快捷切换标的 (最近浏览)</label>
              <div className="flex flex-wrap gap-1.5">
                {recentStocks.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => handleSymbolChange(item.symbol)}
                    className={`py-1 py-1.5 px-2.5 rounded text-[11px] font-sans font-medium transition-all border shrink-0 ${
                      symbol.toUpperCase() === item.symbol.toUpperCase()
                        ? 'bg-orange-600/10 border-orange-500/50 text-orange-400' 
                        : 'bg-neutral-950/60 border-neutral-900 text-neutral-400 hover:border-neutral-800 hover:text-orange-300'
                    }`}
                    title={`${item.symbol} - ${item.name}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 输入代码 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block font-medium">标的代码 (Symbol)</label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().trim();
                    setSymbol(val);
                    if (/^\d{6}$/.test(val) || /^(sh|sz|bj)\d{6}$/i.test(val)) {
                      fetchBrokerData(val);
                    }
                  }}
                  placeholder="例如: 600519"
                  className="flex-1 bg-neutral-950 border border-neutral-900 focus:border-orange-500/40 rounded px-3 py-2 text-sm font-mono text-orange-400 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => fetchBrokerData(symbol)}
                  className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 px-3.5 py-2 rounded transition-all font-sans font-medium hover:text-orange-400 shrink-0"
                  title="获取最新A股行情与资金流数据"
                >
                  同步行情
                </button>
              </div>
              {stockName && (
                <div className="flex items-center space-x-1.5 text-xs text-orange-400 bg-orange-950/20 px-2.5 py-1.5 rounded border border-orange-900/40 font-mono mt-1 w-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
                  <span className="text-neutral-400 text-[11px]">公司全称:</span>
                  <span className="font-bold text-orange-400 text-[11px] truncate">{stockName}</span>
                </div>
              )}
            </div>

            {/* 意图 Prompt */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block font-medium">分析意图及指示 (Prompt)</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="请输入您的研究指示点..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-900 focus:border-orange-500/40 rounded px-3 py-2 text-xs font-mono text-neutral-300 focus:outline-none transition-all resize-none"
              />
            </div>

            {/* 量化指标模拟器 */}
            <div className="border-t border-neutral-900/80 pt-4 space-y-3.5">
              <h4 className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest font-semibold block">实时量化特征参数</h4>
              
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[9px] font-mono text-neutral-500 block mb-1 uppercase font-medium">股票价格 ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none text-neutral-200"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-neutral-500 block mb-1 uppercase font-medium">大资金净流入 (百万$)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={institutionalFlow}
                      onChange={(e) => setInstitutionalFlow(parseFloat(e.target.value) || 0)}
                      className={`w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none ${
                        institutionalFlow > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    />
                    <Coins className="absolute right-2 top-2.5 w-3.5 h-3.5 text-neutral-600 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono text-neutral-500 block mb-1 uppercase font-medium">单日交易量 (股)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="10000"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none text-neutral-200"
                  />
                  <BarChart3 className="absolute right-2 top-2.5 w-3.5 h-3.5 text-neutral-600 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono text-neutral-500 block mb-1 uppercase font-medium">均线趋势方向</label>
                  <select
                    value={priceTrend}
                    onChange={(e: any) => setPriceTrend(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-900 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-300 focus:outline-none animate-none"
                  >
                    <option value="up">向上多头 (UP)</option>
                    <option value="down">向下空头 (DOWN)</option>
                    <option value="flat">箱体振荡 (FLAT)</option>
                  </select>
                </div>
                
                <div className="flex flex-col justify-end pb-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={breakdown}
                      onChange={(e) => setBreakdown(e.target.checked)}
                      className="rounded border-neutral-900 bg-neutral-950 text-orange-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-tighter">破位关键支撑</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 迷你最近 7 日收盘价趋势图 */}
            <div className="bg-neutral-950/20 p-3 rounded-lg border border-neutral-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono text-neutral-400 uppercase tracking-wider font-semibold flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                  <span>最近 7 日历史收盘价波动轨迹</span>
                </span>
                <span className="text-[8px] font-mono text-orange-400 border border-orange-500/10 px-1 bg-orange-950/20 rounded font-bold uppercase shrink-0">
                  7-Day Trend
                </span>
              </div>
              <div className="h-[95px] w-full flex items-center justify-center relative overflow-hidden bg-neutral-950/80 p-1.5 rounded-md border border-neutral-900/60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={generateSevenDayHistory(price, priceTrend, symbol)}
                    margin={{ top: 4, right: 4, left: -24, bottom: -4 }}
                  >
                    <defs>
                      <linearGradient id="colorPriceTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#404040" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                      dy={2}
                      className="font-mono"
                    />
                    <YAxis 
                      stroke="#404040" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                      domain={['auto', 'auto']}
                      className="font-mono"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#09090b',
                        border: '1px solid #1c1917',
                        borderRadius: '4px',
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        color: '#d4d4d4',
                        padding: '3px 4px'
                      }}
                      itemStyle={{ color: '#f97316', padding: 0 }}
                      labelStyle={{ color: '#737373', fontWeight: 'bold' }}
                      formatter={(val: any) => [`$${parseFloat(val).toFixed(2)}`, '收盘价']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Price" 
                      stroke="#f97316" 
                      strokeWidth={1.5}
                      fillOpacity={1} 
                      fill="url(#colorPriceTrend)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 执行量化流水线按钮 */}
            <button
              type="button"
              onClick={runPipeline}
              disabled={isLoading}
              className="w-full cursor-pointer overflow-hidden border border-orange-500 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-orange-50 font-bold py-2.5 rounded-lg text-xs tracking-wider uppercase transition-all shadow-lg shadow-orange-700/20 active:scale-95 flex items-center justify-center space-x-2 mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>多智能体协同评估中...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>启动量化决策流水线</span>
                </>
              )}
            </button>
          </section>

          {/* 券商数据接口 */}
          <div className="bg-neutral-900/10 border border-neutral-900/90 rounded-md p-3 text-[10px] font-mono text-neutral-500 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-950 pb-1.5">
              <span className="font-bold uppercase tracking-widest">外部中间件连接状态</span>
              <span className="text-emerald-500">高级仿真模式开启</span>
            </div>
            <p>JCP Go Broker API 挂载在本地 9000 端口。若处于研发沙盒环境，量化引擎将无缝切换到本地高保真行情流上运行。</p>
          </div>
        </div>

        {/* 中间区：实时知识图谱与运行痕迹 */}
        <div className={`${isGraphFullscreen ? 'lg:col-span-12' : 'lg:col-span-5'} flex flex-col space-y-4`}>
          
          {/* 知识图谱画布 */}
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm grow flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Network className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">持久化知识图谱时序网络 (KG)</h3>
              </div>
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] font-sans text-neutral-400 select-none hover:text-neutral-200 transition-colors bg-neutral-950/40 px-2 py-1 rounded border border-neutral-900">
                  <input
                    type="checkbox"
                    checked={filterActiveOnly}
                    onChange={(e) => setFilterActiveOnly(e.target.checked)}
                    className="rounded border-neutral-800 bg-neutral-950 text-orange-600 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                  />
                  <span>仅看当前标的</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsGraphFullscreen(!isGraphFullscreen)}
                  className="flex items-center space-x-1 py-1 px-2 text-[10px] font-sans text-neutral-400 select-none hover:text-neutral-200 hover:border-neutral-700/80 transition-all bg-neutral-950/50 hover:bg-neutral-950/80 rounded border border-neutral-900 active:scale-95"
                  title={isGraphFullscreen ? '退出沉浸式全屏' : '图谱全屏沉浸分析'}
                >
                  {isGraphFullscreen ? (
                    <>
                      <Minimize2 className="w-3 h-3 text-orange-400" />
                      <span>常规模式</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3 h-3 text-orange-400" />
                      <span>全谱分析</span>
                    </>
                  )}
                </button>
                 <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden sm:inline">关系数据库实时矩阵</span>
              </div>
            </div>

            {/* 关系与拓扑布局综合过滤器 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5 bg-neutral-950/45 p-2 rounded-lg border border-neutral-900/60 shrink-0">
              {/* 关系类型动态过滤器 */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-neutral-500 mr-1.5 font-semibold">关系过滤:</span>
                {[
                  { id: 'ALL', name: '全部关系', color: 'border-neutral-800 text-neutral-300' },
                  { id: 'IN_STATE', name: 'IN_STATE', desc: '状态阶段', color: 'border-yellow-500/20 text-yellow-400 bg-yellow-950/10' },
                  { id: 'HAS_SIGNAL', name: 'HAS_SIGNAL', desc: '指标关联', color: 'border-blue-500/20 text-blue-400 bg-blue-950/10' },
                  { id: 'CAUSED_BY', name: 'CAUSED_BY', desc: '因果驱动', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-950/10' },
                  { id: 'HAS_FEEDBACK', name: 'HAS_FEEDBACK', desc: '网络反馈', color: 'border-purple-500/20 text-purple-400 bg-purple-950/10' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRelationFilter(opt.id)}
                    className={`px-2 py-0.5 text-[9px] font-sans rounded border transition-all cursor-pointer ${
                      relationFilter === opt.id
                        ? `border-orange-500 bg-orange-950/50 text-orange-400 font-semibold shadow-sm`
                        : `${opt.color} hover:bg-neutral-900/45 hover:text-neutral-200`
                    }`}
                  >
                    <span className="font-mono font-medium">{opt.name}</span>
                    {opt.desc && <span className="text-[8px] opacity-70 ml-1">({opt.desc})</span>}
                  </button>
                ))}
              </div>

              {/* 布局切换器 */}
              <div className="flex items-center gap-1.5 sm:border-l sm:border-neutral-800/80 sm:pl-2.5">
                <span className="text-[11px] font-mono text-neutral-500 font-semibold">拓扑布局:</span>
                {[
                  { id: 'orbit', name: '智能星轨', desc: '圆环轨道', icon: Orbit },
                  { id: 'force', name: '力导拓扑', desc: 'Force-directed', icon: Network }
                ].map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayoutMode(opt.id as 'orbit' | 'force')}
                      className={`px-2 py-0.5 text-[9px] font-sans rounded border transition-all cursor-pointer flex items-center space-x-1 ${
                        layoutMode === opt.id
                          ? `border-orange-500 bg-orange-950/50 text-orange-400 font-semibold shadow-sm`
                          : `border-neutral-800 text-neutral-400 hover:bg-neutral-900/45 hover:text-neutral-200`
                      }`}
                      title={opt.desc}
                    >
                      <Icon className="w-2.5 h-2.5 text-orange-500/85" />
                      <span className="font-mono">{opt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`relative border border-neutral-950 rounded-lg bg-neutral-950/80 grow flex flex-col select-none overflow-hidden ${isGraphFullscreen ? 'min-h-[560px]' : 'min-h-[320px]'}`}>
              {/* 背景格栅 */}
              <div 
                className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" 
                style={{ width: '100%', height: '100%' }}
              />

              {/* 浮动画布交互控制面板 */}
              <div className="absolute right-3.5 bottom-3.5 z-30 flex flex-col sm:flex-row items-center bg-neutral-950/90 border border-neutral-800/80 px-2.5 py-1.5 rounded-lg shadow-2xl text-[10px] text-neutral-400 gap-2 sm:gap-3.5 font-mono">
                <span className="text-neutral-500 font-semibold uppercase tracking-wider select-none hidden md:inline">交互建议: 鼠标拖拽平移 / 滚轮缩放</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-neutral-500 font-semibold select-none">比例:</span>
                  <button 
                    type="button" 
                    onClick={() => setZoomScale(prev => Math.max(0.3, prev - 0.1))} 
                    className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white transition cursor-pointer active:scale-90 font-bold"
                    title="缩小 (Zoom Out)"
                  >
                    -
                  </button>
                  <span className="text-orange-400 font-bold min-w-[32px] text-center">{Math.round(zoomScale * 100)}%</span>
                  <button 
                    type="button" 
                    onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.1))} 
                    className="px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white transition cursor-pointer active:scale-90 font-bold"
                    title="放大 (Zoom In)"
                  >
                    +
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setZoomScale(1.0); setPanOffset({ x: 0, y: 0 }); }} 
                    className="ml-1 px-1.5 py-0.5 rounded border border-orange-950 bg-orange-950/20 text-orange-400 hover:bg-orange-900/35 hover:text-orange-300 text-[9px] transition cursor-pointer active:scale-95"
                    title="复位图谱尺寸与位置"
                  >
                    复位
                  </button>
                </div>
              </div>
              
              <svg 
                className={`relative z-10 w-full select-none outline-none transition-shadow ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} 
                style={{ height: `${svgHeight}px`, minHeight: `${svgHeight}px` }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#3b82f6" opacity="0.6" />
                  </marker>
                  <marker id="arrow-state" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#eab308" opacity="0.8" />
                  </marker>
                </defs>

                {/* 空状态温馨提示 */}
                {displayGraphData.nodes.length === 0 && (
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    fill="#737373"
                    fontSize="11px"
                    fontFamily="monospace"
                    className="select-none pointer-events-none"
                  >
                    未建立当前标的的拓扑网络。点击左下方“启动量化决策流水线”可生成！
                  </text>
                )}

                {/* 拓扑缩放与拖拽视口层 */}
                <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomScale})`}>
                  {/* 拓扑连线 */}
                  {filteredRelationships.map((rel) => {
                    const source = positions[rel.source];
                    const target = positions[rel.target];
                    if (!source || !target) return null;

                    const isState = rel.type === 'IN_STATE';
                    return (
                      <line
                        key={rel.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isState ? '#eab308' : '#3b82f6'}
                        strokeWidth={isState ? 1.5 : 1}
                        strokeDasharray={isState ? "0" : "3 3"}
                        strokeOpacity={0.7}
                        markerEnd={isState ? "url(#arrow-state)" : "url(#arrow)"}
                      />
                    );
                  })}

                  {/* 节点层渲染 */}
                  {displayGraphData.nodes.map((node) => {
                    const pos = positions[node.id];
                    if (!pos) return null;

                    const isSelected = selectedNode?.id === node.id;
                    let color = '#a3a3a3';
                    let radius = 8;

                    if (node.type === 'Stock') {
                      color = '#f97316';
                      radius = 21;
                    } else if (node.type === 'MarketRegime') {
                      color = '#eab308';
                      radius = 11;
                    } else {
                      color = '#3b82f6';
                      radius = 8;
                    }

                    const isCurrentStock = node.type === 'Stock' && node.properties?.symbol === symbol.toUpperCase();
                    const isFilteredOut = activeFilteredNodeIds !== null && !activeFilteredNodeIds.has(node.id);

                    return (
                      <g
                        key={node.id}
                        className={`cursor-pointer group transition-all duration-300 ${isFilteredOut ? 'opacity-25 grayscale-[75%]' : 'opacity-100'}`}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={() => setSelectedNode(node)}
                      >
                        {/* 外发光动画圈 */}
                        {(isSelected || isCurrentStock) && (
                          <circle
                            r={radius + 6}
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            className="animate-ping"
                            style={{ animationDuration: '3s' }}
                          />
                        )}
                        
                        <circle
                          r={radius}
                          fill={color}
                          fillOpacity={0.85}
                          stroke="#0a0a0a"
                          strokeWidth="2"
                          className="group-hover:fill-orange-400 transition-colors"
                        />

                        {/* 标的/信号类型或标签文本 */}
                        <text
                          y={node.type === 'Stock' ? 4 : 20}
                          textAnchor="middle"
                          fill={isCurrentStock ? '#f97316' : '#d4d4d4'}
                          fontSize={node.type === 'Stock' ? '10px' : '8px'}
                          fontFamily="monospace"
                          fontWeight={node.type === 'Stock' ? 'bold' : 'normal'}
                          className="pointer-events-none select-none drop-shadow text-center"
                        >
                          {getLocalizedNodeLabel(node)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* 节点属性检视器区域 */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    className="absolute bottom-2 left-2 right-2 border border-neutral-900 bg-neutral-900/95 shadow-2xl rounded-lg p-3 z-20 flex flex-col space-y-1.5"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-950 pb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          selectedNode.type === 'Stock' ? 'bg-orange-500' : (selectedNode.type === 'MarketRegime' ? 'bg-yellow-500' : 'bg-blue-500')
                        }`} />
                        <span className="text-[11px] font-mono leading-none text-neutral-400">图数据库节点属性 [类型: {selectedNode.type === 'Stock' ? '标的证券' : (selectedNode.type === 'MarketRegime' ? '状态阶段记录' : '合并共识信号')}]</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNode(null)}
                        className="text-[10px] text-neutral-500 hover:text-neutral-300 font-mono"
                      >
                        [关闭面板]
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      <div>
                        <span className="text-neutral-500">系统内部ID:</span> <span className="text-neutral-300">{selectedNode.id}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">实体主要标签:</span> <span className="text-orange-400 font-semibold">{getLocalizedNodeLabel(selectedNode)}</span>
                      </div>
                      {Object.entries(selectedNode.properties || {}).map(([k, v]) => {
                        let displayKey = k;
                        let displayValue = typeof v === 'object' ? JSON.stringify(v) : String(v);

                        if (k === 'symbol') displayKey = '交易代号';
                        else if (k === 'state') {
                          displayKey = '迁移阶段';
                          displayValue = LOCALIZATION_MAP[v as string] || displayValue;
                        } else if (k === 'company_name') displayKey = '公司中文名称';
                        else if (k === 'timestamp') displayKey = '更新时间戳';
                        else if (k === 'type') {
                          displayKey = '信号特征分类';
                          displayValue = LOCALIZATION_MAP[v as string] || displayValue;
                        } else if (k === 'value') {
                          displayKey = '评估监测值';
                          displayValue = v === true ? '是 (触发)' : (v === false ? '否 (冷却)' : displayValue);
                        } else if (k === 'historical_prices') displayKey = '历史时序价格样本';
                        else if (k === 'historical_volumes') displayKey = '历史时序成交量样本';
                        else if (k === 'time_window') displayKey = '回溯采样时间窗';

                        return (
                          <div key={k} className="col-span-2 border-t border-neutral-950/20 pt-1">
                            <span className="text-neutral-500 uppercase">{displayKey}:</span>{' '}
                            <span className="text-blue-300 whitespace-pre-wrap">{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 交互小字样 */}
              <div className="absolute top-2 right-2 text-[8px] font-mono text-neutral-500 bg-neutral-900/50 px-1 rounded pointer-events-none">
                点击上方圆圈节点，在下方动态抽屉可展开持久化关系
              </div>
            </div>
          </section>

          {/* LangGraph 调试监视窗口 */}
          <section className={`${isGraphFullscreen ? 'hidden' : 'bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm h-[180px] flex flex-col'}`}>
            <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-2">
              <div className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">LangGraph 编排执行流日志 (Trace)</h3>
              </div>
              <span className="text-[8px] font-mono text-teal-400 font-semibold">LANGGRAPH KERNEL ACTIVE</span>
            </div>

            <div className="bg-neutral-950 border border-neutral-950 p-2.5 rounded-lg grow font-mono text-[9px] text-neutral-300 overflow-y-auto space-y-1 select-text scrollbar-thin">
              {executionLogs.length === 0 ? (
                <div className="text-neutral-600 italic h-full flex items-center justify-center">
                  量化推理引擎静默中。请点击左下角“启动量化决策流水线”以观测状态机跳转与图谱生成逻辑...
                </div>
              ) : (
                executionLogs.map((log, i) => {
                  let color = 'text-neutral-300';
                  if (log.includes('[ERROR]') || log.includes('[错误]')) color = 'text-rose-400';
                  else if (log.includes('[NODE]')) color = 'text-orange-400/80';
                  else if (log.includes('TRANSITION') || log.includes('SUCCESS') || log.includes('成功')) color = 'text-yellow-400';
                  else if (log.includes('END:') || log.includes('完成')) color = 'text-teal-400';

                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: -5 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ duration: 0.1, delay: Math.min(i * 0.05, 0.5) }}
                      key={i} 
                      className={`${color} leading-relaxed`}
                    >
                      {log}
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* 右侧：有限状态机及最终决策成果 */}
        <div className={`${isGraphFullscreen ? 'hidden' : 'lg:col-span-4 flex flex-col space-y-4'}`}>
          
          {/* 有限状态机渲染 */}
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm self-start w-full">
            <div className="flex items-center space-x-2 border-b border-neutral-900 pb-3 mb-4">
              <Activity className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">有限状态机 (FSM) 周期决策链看板</h3>
            </div>

            {/* FSM 五阶段 */}
            <div className="space-y-2.5">
              {statesFlow.map((st, i) => {
                const isActive = activeStateKey === st.key;
                return (
                  <div
                    key={st.key}
                    className={`border rounded-lg p-3 transition-all relative overflow-hidden ${
                      isActive 
                        ? 'bg-neutral-900/90 border-orange-500/80 shadow-md shadow-orange-500/5' 
                        : 'bg-neutral-950/40 border-neutral-900/80 hover:bg-neutral-900/20'
                    }`}
                  >
                    {/* 当前活动状态边缘亮条 */}
                    {isActive && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono leading-none ${
                          isActive ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' : 'bg-neutral-900 text-neutral-500'
                        }`}>
                          0{i+1}
                        </div>
                        <span className={`text-[11px] font-mono font-bold tracking-tight uppercase ${
                          isActive ? 'text-orange-400' : 'text-neutral-400'
                        }`}>
                          {st.label}
                        </span>
                      </div>

                      {isActive && (
                        <span className="text-[9px] font-mono bg-orange-600/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 animate-pulse font-semibold">
                          状态机主力共识区间
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 pl-7 font-sans">{st.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 量化综合智检报告 */}
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm grow flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-3 shrink-0">
              <div className="flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">终审决策报告摘要</h3>
              </div>
              <Sparkles className="w-4 h-4 text-orange-500/70" />
            </div>

            <div className="flex-grow flex flex-col justify-between">
              {runResult ? (
                <div className="space-y-3.5">
                  
                  {/* 标的头卡 */}
                  <div className="flex items-center justify-between bg-neutral-950/70 py-2 w-full px-3 rounded-md border border-neutral-900">
                    <div>
                      <span className="text-[9px] font-mono text-neutral-500 block font-semibold">当前执审标的</span>
                      <span className="text-sm font-mono font-bold text-orange-400">{runResult.symbol}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-mono text-neutral-500 block font-semibold">出炉市场状态</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 border rounded uppercase ${getRegimeColor(runResult.market_state)}`}>
                        {runResult.market_state === 'ACCUMULATION' ? '主力吸筹期' : 
                         runResult.market_state === 'BREAKOUT' ? '放量突破区' : 
                         runResult.market_state === 'TREND_EXPANSION' ? '趋势主升浪' : 
                         runResult.market_state === 'DISTRIBUTION' ? '高位派发期' : 
                         runResult.market_state === 'DECLINE' ? '高危衰退区' : runResult.market_state}
                      </span>
                    </div>
                  </div>

                  {/* 动态 L3 认知切换微控制卡 */}
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5 overflow-x-auto scrollbar-none">
                    {[
                      { key: 'opinion', name: '研报终审' },
                      { key: 'markov', name: '概率推演' },
                      { key: 'causal', name: '因果/博弈' },
                      { key: 'execution', name: '算法执行' },
                      { key: 'memory', name: '自更新记忆' }
                    ].map((tab) => {
                      const isActive = activeResultTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveResultTab(tab.key)}
                          className={`text-[9px] font-mono font-bold uppercase pb-1 px-1 transition-all border-b-2 whitespace-nowrap ${
                            isActive 
                              ? 'text-orange-400 border-orange-500 font-extrabold' 
                              : 'text-neutral-500 border-transparent hover:text-neutral-300'
                          }`}
                        >
                          {tab.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* 1. 研报终审标签页 */}
                  {activeResultTab === 'opinion' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      {/* 智能体投票 */}
                      <div className="bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900/60 text-[10px] font-mono space-y-1">
                        <span className="text-neutral-500 block text-[9px] uppercase tracking-wider font-semibold">多智能体表决状态：</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${runResult.signals.volume_breakout ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-800'}`} />
                            <span className="text-neutral-400">技术量能突破</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${runResult.signals.trend_confirmed ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-800'}`} />
                            <span className="text-neutral-400">均线支撑金叉</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${runResult.signals.fund_flow_negative ? 'bg-rose-500 animate-pulse' : 'bg-neutral-800'}`} />
                            <span className="text-neutral-400">大单出货净流出</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${runResult.signals.breakdown ? 'bg-rose-500 animate-pulse' : 'bg-neutral-800'}`} />
                            <span className="text-neutral-400">支撑重心下移</span>
                          </div>
                        </div>
                      </div>

                      {/* 智能核验意见 */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-orange-500 uppercase tracking-wider font-semibold flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                          <span>Gemini 3.5 智能终审评级与解读:</span>
                        </span>
                        <div className="bg-neutral-950/90 p-3 rounded-lg border border-orange-500/10 text-xs text-neutral-300 leading-relaxed font-sans max-h-[160px] overflow-y-auto scrollbar-thin">
                          {runResult.opinions[0]}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-neutral-500 block font-semibold uppercase">API 终核决策控制载荷 (JSON Payload):</span>
                        <pre className="bg-neutral-950 p-2 rounded text-[9.5px] font-mono text-neutral-400 max-h-[75px] overflow-y-auto border border-neutral-900 border-dashed">
                          {runResult.final_decision}
                        </pre>
                      </div>
                    </motion.div>
                  )}

                  {/* 2. 马尔可夫概率演推页 */}
                  {activeResultTab === 'markov' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-bold">马尔可夫模型 - 周期候选阶段转移概率分布</span>
                          <span className="text-[8px] font-mono text-orange-400 px-1 border border-orange-500/10 rounded">PREDICTIVE</span>
                        </div>

                        {runResult.probabilistic_transitions && runResult.probabilistic_transitions.length > 0 ? (
                          <div className="space-y-2">
                            {runResult.probabilistic_transitions.map((p, idx) => {
                              const transName = 
                                p.state === 'ACCUMULATION' ? '主力吸筹期' : 
                                p.state === 'BREAKOUT' ? '放量突破区' : 
                                p.state === 'TREND_EXPANSION' ? '趋势主升浪' : 
                                p.state === 'DISTRIBUTION' ? '高位派发期' : 
                                p.state === 'DECLINE' ? '高危衰退区' : p.state;

                              const barWidth = `${p.probability}%`;
                              const scoreColor = p.probability >= 50 ? 'bg-orange-600/90' : 'bg-neutral-700';

                              return (
                                <div key={p.state} className="space-y-1">
                                  <div className="flex justify-between items-center text-[10px] font-mono text-neutral-300">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-neutral-500">0{idx + 1}</span>
                                      <span className={`${p.probability >= 50 ? 'text-orange-400 font-semibold' : 'text-neutral-400'}`}>{transName}</span>
                                    </div>
                                    <span className="font-bold text-orange-400">{p.probability}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-950">
                                    <div className={`h-full ${scoreColor} rounded-full transition-all duration-500`} style={{ width: barWidth }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-neutral-500 italic py-4 text-center">暂无概率矩阵输出。请重新对股票进行一次“起飞点火”决策运行。</div>
                        )}
                        <p className="text-[9px] text-neutral-500 font-sans leading-relaxed pt-1 border-t border-neutral-900/40">
                          * 概率转移决策由状态转换器 (transitionWithArbiter) 输入多方均线重力、成交大单倾向及背离阻断阀值进行实时归一化平滑得出。
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* 3. 因果分析 & 智能体对抗博弈 */}
                  {activeResultTab === 'causal' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      {/* 因果溯源图谱路径 */}
                      <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 space-y-1.5">
                        <span className="text-[9px] font-mono text-neutral-400 block font-semibold uppercase tracking-wider border-b border-neutral-900 pb-1">
                          因果分析图谱链 (Causal Attribution Graphs)
                        </span>
                        <div className="space-y-1.5 text-[9.5px] font-mono text-neutral-300 max-h-[110px] overflow-y-auto scrollbar-thin leading-normal">
                          {(runResult.causal_pathways || []).map((path, idx) => (
                            <div key={idx} className="p-1 px-1.5 bg-neutral-900/50 rounded border border-neutral-900/40 text-neutral-300 leading-normal">
                              {path}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 多智能体对抗对战文字稿 */}
                      <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 space-y-1.5">
                        <span className="text-[9px] font-mono text-neutral-400 block font-semibold uppercase tracking-wider border-b border-neutral-900 pb-1">
                          智能体席位博弈辩论录 (Adversarial Multi-Agent Debate)
                        </span>
                        <div className="space-y-1.5 text-[9.5px] font-mono overflow-y-auto max-h-[110px] uppercase scrollbar-thin">
                          {(runResult.debate_transcript || []).map((line, idx) => {
                            let textClass = "text-neutral-400 border-neutral-900 bg-neutral-950/60";
                            if (line.includes('技术')) textClass = "text-teal-300 border-teal-900/30 bg-teal-950/10";
                            else if (line.includes('资金') && line.includes('等')) textClass = "text-rose-300 border-rose-900/30 bg-rose-950/10";
                            else if (line.includes('资金') && !line.includes('等')) textClass = "text-amber-300 border-amber-900/30 bg-amber-950/10";
                            else if (line.includes('裁判') || line.includes('安全')) textClass = "text-orange-400 border-orange-900/30 bg-orange-950/20";

                            return (
                              <div key={idx} className={`p-1.5 rounded border leading-normal ${textClass}`}>
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* 4. 算法执行指令和路由 */}
                  {activeResultTab === 'execution' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      {runResult.execution_plan ? (
                        <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-bold">算法柜台交易委托单 (Execution Ticket)</span>
                            <span className="text-[8px] font-mono text-teal-400 font-semibold px-1 bg-teal-950/50 border border-teal-800 rounded">READY</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="p-2 bg-neutral-900/60 rounded border border-neutral-900/80">
                              <span className="text-neutral-500 block text-[9px] uppercase font-semibold">指令指令行为 (Action)</span>
                              <span className={`text-base font-extrabold uppercase ${
                                runResult.execution_plan.action === 'BUY' ? 'text-emerald-500' :
                                runResult.execution_plan.action === 'SELL' ? 'text-rose-500 animate-pulse' : 'text-neutral-300'
                              }`}>
                                {runResult.execution_plan.action === 'BUY' ? '买入委托 BUY' :
                                 runResult.execution_plan.action === 'SELL' ? '卖出平仓 SELL' : '维持观望 HOLD'}
                              </span>
                            </div>

                            <div className="p-2 bg-neutral-900/60 rounded border border-neutral-900/80">
                              <span className="text-neutral-500 block text-[9px] uppercase font-semibold">执行算法路径 (Route)</span>
                              <span className="text-sm font-bold text-orange-400">
                                {runResult.execution_plan.routeType} 路由算法
                              </span>
                            </div>

                            <div className="p-2 bg-neutral-900/60 rounded border border-neutral-900/80">
                              <span className="text-neutral-500 block text-[9px] uppercase font-semibold">委托限价 (Price Limit)</span>
                              <span className="text-sm font-bold text-neutral-100">
                                ${runResult.execution_plan.priceLimit} USD
                              </span>
                            </div>

                            <div className="p-2 bg-neutral-900/60 rounded border border-neutral-900/80">
                              <span className="text-neutral-500 block text-[9px] uppercase font-semibold">下单量 (Quantity)</span>
                              <span className="text-sm font-bold text-neutral-100">
                                {runResult.execution_plan.quantity} 股 / 份
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-neutral-900/40 rounded border border-neutral-900 font-sans text-xs text-neutral-300 leading-normal">
                            <span className="text-[9px] font-mono text-neutral-500 block font-semibold uppercase mb-0.5">决策柜台成交理由:</span>
                            {runResult.execution_plan.rationale}
                          </div>

                          <div className="flex justify-between items-center text-[8.5px] font-mono text-neutral-500 border-t border-neutral-900/50 pt-1.5">
                            <span>算法成交紧迫度: <span className="font-extrabold text-orange-400">{runResult.execution_plan.urgency}</span></span>
                            <span>安全风控阀门: C_BROKER_OK</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-neutral-500 italic py-8 text-center bg-neutral-900/20 border border-neutral-900 rounded-lg">暂无算法执行指令生成。</div>
                      )}
                    </motion.div>
                  )}

                  {/* 5. 自更新记忆与反馈迭代 */}
                  {activeResultTab === 'memory' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      {runResult.memory_feedback ? (
                        <div className="bg-neutral-950/70 p-3 rounded-lg border border-neutral-900 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-neutral-900 pb-1.5">
                            <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider font-bold">图谱自演进记忆机制 (KG Memory Feedback)</span>
                            <span className="text-[8px] font-mono text-teal-400 font-semibold px-1 bg-teal-900/30 border border-teal-900/60 rounded">EVOLVING</span>
                          </div>

                          <div className="space-y-2">
                            <div className="p-2.5 bg-neutral-900/70 rounded border border-neutral-900">
                              <span className="text-[9px] font-mono text-neutral-500 block font-semibold uppercase">周期精准度自评结果 (Accuracy Score)</span>
                              <span className="text-xs font-bold text-teal-400 font-mono block mt-0.5">
                                {runResult.memory_feedback.last_accuracy_status}
                              </span>
                            </div>

                            <div className="p-2.5 bg-neutral-900/70 rounded border border-neutral-900">
                              <span className="text-[9px] font-mono text-neutral-500 block font-semibold uppercase">记忆跟踪与异常报警</span>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${runResult.memory_feedback.anomaly_flagged ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                                <span className="text-xs text-neutral-300 font-mono font-bold">
                                  {runResult.memory_feedback.anomaly_flagged ? '检测到大资金背离/诱多警告！已触发历史异常记录' : '指标高拟合收敛，未检测到重大状态错配异常'}
                                </span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-neutral-900/40 rounded border border-neutral-900 text-xs text-neutral-300 font-sans leading-relaxed">
                              <span className="text-[9px] font-mono text-neutral-500 block font-semibold uppercase mb-0.5 font-mono">记忆自更新日志记录:</span>
                              {runResult.memory_feedback.update_note}
                            </div>
                          </div>

                          <p className="text-[9px] text-neutral-500 font-sans leading-relaxed pt-1 border-t border-neutral-900/40">
                            * 记忆迭代模块在每个决策周期结束后，会自动创建 FeedBack 图节点和 HAS_FEEDBACK 因果关系并入 Knowledge Graph 中，以实现多周期推理的自适应回馈学习。
                          </p>
                        </div>
                      ) : (
                        <div className="text-[10px] text-neutral-500 italic py-8 text-center bg-neutral-900/20 border border-neutral-900 rounded-lg">暂无自更新记忆反馈。</div>
                      )}
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-neutral-600 text-center py-12 px-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-950 border border-neutral-900 flex items-center justify-center mb-3 text-neutral-700">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-mono font-semibold text-neutral-500 uppercase tracking-widest">系统就绪，尚未点火</h4>
                  <p className="text-[10px] max-w-[200px] mt-1">请点击左侧控制栏下方的 “启动量化决策流水线” 启动完整的智能体链条运算评估。</p>
                </div>
              )}

              {/* 架构基本属性 */}
              <div className="pt-3 border-t border-neutral-900/55 text-[9px] font-mono text-neutral-500 flex items-center justify-between mt-4">
                <span>运行模式: 三层架构 (KG 图谱 + 规则状态机 + LangGraph)</span>
                <span>环境: Full-Stack Express Engine</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 页尾声明 */}
      <footer className="border-t border-neutral-950 bg-neutral-950/50 py-3 px-5 text-center flex flex-col md:flex-row justify-between items-center text-[10px] font-mono text-neutral-600 gap-2 shrink-0">
        <div>
          <span>本系统基于 Production Kernels 研发。支持毫秒级时序写入、因果链检索，提供金融级可靠决策矩阵保护。</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="hover:text-neutral-400 cursor-help flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
            <span>决策机安全闭环规则验证成功</span>
          </span>
          <span>北京时间 (GMT+8)</span>
        </div>
      </footer>
    </div>
  );
}
