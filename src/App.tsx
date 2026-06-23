import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { GraphNode, GraphRelationship, MarketData, InvestmentRunResult } from './types';

export default function App() {
  // Config & Inputs state
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [query, setQuery] = useState<string>('当前是否已成功放量突破阻力位？');
  const [price, setPrice] = useState<number>(178.50);
  const [volume, setVolume] = useState<number>(1800000);
  const [priceTrend, setPriceTrend] = useState<'up' | 'down' | 'flat'>('up');
  const [institutionalFlow, setInstitutionalFlow] = useState<number>(12.8);
  const [breakdown, setBreakdown] = useState<boolean>(false);

  // Application Data state
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; relationships: GraphRelationship[] }>({
    nodes: [],
    relationships: []
  });
  const [runResult, setRunResult] = useState<InvestmentRunResult | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [systemTime, setSystemTime] = useState<string>('');

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
    fetchBrokerData('AAPL');
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
        const data: MarketData = await res.json();
        setPrice(data.price);
        setVolume(data.volume);
        setPriceTrend(data.price_trend);
        setInstitutionalFlow(data.institutional_flow);
        setBreakdown(data.breakdown);
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
  const computeGraphPositions = () => {
    const w = 620;
    const h = 250;
    const stockNodes = graphData.nodes.filter(n => n.type === 'Stock');
    const signalNodes = graphData.nodes.filter(n => n.type === 'Signal');
    const regimeNodes = graphData.nodes.filter(n => n.type === 'MarketRegime');

    const coords: Record<string, { x: number; y: number }> = {};

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
    graphData.relationships.forEach((rel) => {
      const sourcePt = coords[rel.source];
      if (!sourcePt) return;

      const targetNode = graphData.nodes.find(n => n.id === rel.target);
      if (!targetNode) return;

      if (!coords[targetNode.id]) {
        // Stagger positions in orbits based on target types
        if (targetNode.type === 'MarketRegime') {
          coords[targetNode.id] = {
            x: sourcePt.x,
            y: sourcePt.y - 70 // Regime straight above
          };
        } else {
          // Signals arranged in circular array around stock
          const sIndex = signalNodes.indexOf(targetNode);
          const angle = (sIndex * (360 / Math.max(1, signalNodes.length)) * Math.PI) / 180;
          const radius = 60;
          coords[targetNode.id] = {
            x: sourcePt.x + radius * Math.cos(angle + (stockNodes.indexOf(
              stockNodes.find(s => s.id === rel.source) || stockNodes[0]
            ) * 45)),
            y: sourcePt.y + radius * Math.sin(angle) * 0.9 + 15
          };
        }
      }
    });

    return coords;
  };

  const positions = computeGraphPositions();

  // Helper colors for state machine steps
  const statesFlow = [
    { key: "ACCUMULATION", label: "ACCUMULATION", desc: "主力震荡洗盘吸筹期 (吸筹)" },
    { key: "BREAKOUT", label: "BREAKOUT", desc: "放量向上突破震荡阻力 (突破)" },
    { key: "TREND_EXPANSION", label: "TREND EXPANSION", desc: "主升浪多头动能扩张 (多头)" },
    { key: "DISTRIBUTION", label: "DISTRIBUTION", desc: "筹码高位松动派发出货 (派发)" },
    { key: "DECLINE", label: "DECLINE", desc: "顺势向下调整跌破支撑 (衰退)" }
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
    (graphData.nodes.find(n => n.type === 'Stock' && n.properties.symbol === symbol.toUpperCase()) ? 
      (() => {
        const stockNode = graphData.nodes.find(n => n.type === 'Stock' && n.properties.symbol === symbol.toUpperCase());
        const rels = graphData.relationships.filter(r => r.source === stockNode?.id && r.type === 'IN_STATE');
        if (rels.length > 0) {
          const target = graphData.nodes.find(n => n.id === rels[rels.length - 1].target);
          return target?.properties.state;
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
            <h1 className="text-sm font-bold tracking-wider text-neutral-100">INVESTMENT OS</h1>
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
        <div className="lg:col-span-3 flex flex-col space-y-4">
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
              <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block font-medium">快捷切换标的</label>
              <div className="grid grid-cols-4 gap-1.5">
                {['AAPL', 'TSLA', 'NVDA', 'BTC'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleSymbolChange(sym)}
                    className={`py-1.5 px-1 rounded text-xs font-mono font-medium transition-all border ${
                      symbol.toUpperCase() === sym 
                        ? 'bg-orange-600/10 border-orange-500/50 text-orange-400' 
                        : 'bg-neutral-950/60 border-neutral-900 text-neutral-400 hover:border-neutral-800'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* 输入代码 */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block font-medium">标的代码 (Symbol)</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="例如: MSFT"
                className="w-full bg-neutral-950 border border-neutral-900 focus:border-orange-500/40 rounded px-3 py-2 text-sm font-mono text-orange-400 focus:outline-none transition-all"
              />
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
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* 知识图谱画布 */}
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm grow flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Network className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">持久化知识图谱时序网络 (KG)</h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">关系数据库实时矩阵</span>
            </div>

            <div className="relative border border-neutral-950 rounded-lg bg-neutral-950/80 grow min-h-[300px] flex flex-col select-none overflow-hidden">
              {/* 背景格栅 */}
              <div className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
              
              <svg className="w-full h-full relative z-10" style={{ minHeight: '300px' }}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#3b82f6" opacity="0.6" />
                  </marker>
                  <marker id="arrow-state" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#eab308" opacity="0.8" />
                  </marker>
                </defs>

                {/* 拓扑连线 */}
                {graphData.relationships.map((rel) => {
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
                      strokeOpacity={0.5}
                      markerEnd={isState ? "url(#arrow-state)" : "url(#arrow)"}
                    />
                  );
                })}

                {/* 节点层渲染 */}
                {graphData.nodes.map((node) => {
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

                  const isCurrentStock = node.type === 'Stock' && node.properties.symbol === symbol.toUpperCase();

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer group"
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
                        {node.type === 'Stock' ? node.label : (node.properties.type || node.label.substring(0, 12))}
                      </text>
                    </g>
                  );
                })}
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
                        <span className="text-neutral-500">实体主要标签:</span> <span className="text-orange-400 font-semibold">{selectedNode.label}</span>
                      </div>
                      {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                        <div key={k} className="col-span-2 border-t border-neutral-950/20 pt-1">
                          <span className="text-neutral-500 uppercase">{k === 'symbol' ? '交易代号' : (k === 'state' ? '迁移阶段' : k === 'company_name' ? '公司中文名称' : k)}:</span>{' '}
                          <span className="text-blue-300 whitespace-pre-wrap">{JSON.stringify(v)}</span>
                        </div>
                      ))}
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
          <section className="bg-neutral-900/30 border border-neutral-900/90 rounded-xl p-4 shadow-xl backdrop-blur-sm h-[180px] flex flex-col">
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
        <div className="lg:col-span-4 flex flex-col space-y-4">
          
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
                <div className="space-y-4">
                  
                  {/* 标的头卡 */}
                  <div className="flex items-center justify-between bg-neutral-950/70 py-2 px-3 rounded-md border border-neutral-900">
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

                  {/* 智能体投票 */}
                  <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-900/60 text-[10px] font-mono space-y-1.5">
                    <span className="text-neutral-500 block text-[9px] uppercase tracking-wider font-semibold">多智能体分项表决标识：</span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${runResult.signals.volume_breakout ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
                        <span className="text-neutral-300">技术量能突破已生成</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${runResult.signals.trend_confirmed ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
                        <span className="text-neutral-300">均线支撑金叉对齐</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${runResult.signals.fund_flow_negative ? 'bg-rose-500' : 'bg-neutral-800'}`} />
                        <span className="text-neutral-300 font-semibold">大单出货净流出</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${runResult.signals.breakdown ? 'bg-rose-500' : 'bg-neutral-800'}`} />
                        <span className="text-neutral-300">支撑重心破坏下移</span>
                      </div>
                    </div>
                  </div>

                  {/* 智能终审意见 */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-orange-500 uppercase tracking-wider font-semibold flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                      <span>Gemini 3.5 智能终审评级与解读:</span>
                    </span>
                    <div className="bg-neutral-950/90 p-3.5 rounded-lg border border-orange-500/10 text-xs text-neutral-300 leading-relaxed font-sans">
                      {runResult.opinions[0]}
                    </div>
                  </div>

                  {/* 终审决策 JSON 细节 */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-neutral-400 block font-semibold uppercase">API 终核控制信号结构体(JSON Payload):</span>
                    <pre className="bg-neutral-950 p-2.5 rounded text-[10px] font-mono text-neutral-400 max-h-[85px] overflow-y-auto border border-neutral-900 border-dashed">
                      {runResult.final_decision}
                    </pre>
                  </div>
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
