import React, { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Play, Pause, RotateCcw, Edit2, TrendingUp, TrendingDown, AlertTriangle, Wifi, Activity, ChevronUp, ChevronDown, LogOut, Bell, BellOff, Clock, Loader } from 'lucide-react'
import { notify } from './notify.js'

const LEVEL_RATES = { '1': 4, '2': 4.5, '3': 5, '4': 6 }

function getLevelRate(level) {
  return LEVEL_RATES[String(level)] || 4
}

function calcRatePerHour(streak, level) {
  return getLevelRate(level) * (1 + streak * 0.01)
}

function useBlink(active, interval = 500) {
  const [vis, setVis] = useState(true)
  useEffect(() => {
    if (!active) { setVis(true); return }
    const id = setInterval(() => setVis(v => !v), interval)
    return () => clearInterval(id)
  }, [active, interval])
  return vis
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function briefText(str) {
  if (!str) return ''
  const cleaned = str.replace(/[\u200e\u200f\u00ad\u200b]/g, '').trim()
  return cleaned.length > 3 ? cleaned : ''
}

export default function IncomeMonitor({ user, onLogout }) {
  const [selectedProjectId, setSelectedProjectId] = useState(() => user.projects?.[0]?.id || null)
  const [isRunning, setIsRunning] = useState(false)
  const [activeSeconds, setActiveSeconds] = useState(0)
  const [wallSeconds, setWallSeconds] = useState(0)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [liveChart, setLiveChart] = useState([])
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('im_sessions') || '[]') } catch { return [] }
  })
  const [formula, setFormula] = useState(null)
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)
  const [customFormula, setCustomFormula] = useState('')
  const [now, setNow] = useState(new Date())
  const [notifyOn, setNotifyOn] = useState(true)
  const [notifyStatus, setNotifyStatus] = useState('idle') // idle | sending | done | error

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const activeRef = useRef(isRunning)
  activeRef.current = isRunning

  const project = user.projects?.find(p => p.id === selectedProjectId) || user.projects?.[0]
  const streak = project?.project_streak_days || 1
  const level = project?.level || '1'
  const ratePerHour = formula
    ? (() => { try { return eval(formula.replace('streak', streak).replace('level', getLevelRate(level))) } catch { return calcRatePerHour(streak, level) } })()
    : calcRatePerHour(streak, level)

  const currentIncome = ratePerHour * (activeSeconds / 3600)
  const effectiveRate = wallSeconds > 0 ? currentIncome / (wallSeconds / 3600) : 0

  const projectSessions = sessions.filter(s => s.projectId === project?.id)
  const avgRate = projectSessions.length > 0
    ? projectSessions.reduce((a, s) => a + s.ratePerHour, 0) / projectSessions.length
    : ratePerHour

  const isHigh = isRunning && effectiveRate >= avgRate * 0.85
  const isLow = isRunning && !isHigh
  const alertBlink = useBlink(isLow, 500)

  // Streak risk: check if today has >= 1hr logged in journals
  const todayStr = now.toISOString().slice(0, 10)
  const todayJournalHours = (project?.journals || [])
    .filter(j => j.created_at?.slice(0, 10) === todayStr)
    .reduce((a, j) => a + (j.hours || 0), 0)
  const streakAtRisk = project && todayJournalHours < 1 && project.last_worked_date !== todayStr
  const streakBlink = useBlink(streakAtRisk, 800)

  // Wall clock + chart update
  useEffect(() => {
    if (!sessionStarted) return
    const id = setInterval(() => {
      setWallSeconds(w => w + 1)
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      if (activeRef.current) {
        setActiveSeconds(a => {
          const newActive = a + 1
          const inc = ratePerHour * (newActive / 3600)
          setLiveChart(prev => {
            const wall = prev.length + 1
            const effR = wall > 0 ? inc / (wall / 3600) : 0
            return [...prev.slice(-179), { t, income: parseFloat(inc.toFixed(6)), rate: parseFloat(effR.toFixed(4)), paused: false }]
          })
          return newActive
        })
      } else {
        setLiveChart(prev => {
          const lastIncome = prev.length > 0 ? prev[prev.length - 1].income : 0
          const wall = prev.length + 1
          const effR = wall > 0 ? lastIncome / (wall / 3600) : 0
          return [...prev.slice(-179), { t, income: lastIncome, rate: parseFloat(effR.toFixed(4)), paused: true }]
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStarted, ratePerHour])

  useEffect(() => {
    localStorage.setItem('im_sessions', JSON.stringify(sessions))
  }, [sessions])

  const handleStart = () => {
    if (!sessionStarted) setSessionStarted(true)
    setIsRunning(true)
  }
  const handlePause = () => setIsRunning(false)
  const handleStop = () => {
    setIsRunning(false)
    if (activeSeconds > 0) {
      setSessions(prev => [...prev, {
        id: Date.now(), projectId: project?.id, projectName: project?.name,
        level, streak, duration: activeSeconds, income: currentIncome,
        ratePerHour: effectiveRate,
        timestamp: now.toLocaleDateString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }])
    }
    setActiveSeconds(0); setWallSeconds(0); setSessionStarted(false); setLiveChart([])
  }
  const handleReset = () => {
    setIsRunning(false); setActiveSeconds(0); setWallSeconds(0); setSessionStarted(false); setLiveChart([])
  }

  const prevRate = liveChart.length >= 2 ? liveChart[liveChart.length - 2]?.rate : effectiveRate
  const rateChange = effectiveRate - prevRate

  const todayIncome = sessions.filter(s => s.timestamp === now.toLocaleDateString()).reduce((a, s) => a + s.income, 0) + (sessionStarted ? currentIncome : 0)
  const totalIncome = sessions.reduce((a, s) => a + s.income, 0) + (sessionStarted ? currentIncome : 0)
  const totalJournalHours = project?.journals?.reduce((a, j) => a + (j.hours || 0), 0) || 0

  return (
    <div className="w-full min-h-screen bg-[#060b18] text-white font-mono relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)' }} />

      {/* ── HEADER ── */}
      <div className="relative z-10 border-b border-[#1a2540] bg-[#080d1a] px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[#00ff88] text-xs tracking-[0.25em] font-bold">INCOME/MONITOR</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#00ff88] animate-pulse' : sessionStarted ? 'bg-[#ffd700]' : 'bg-[#334]'}`} />
            <span className="text-[9px] text-[#445]">{isRunning ? 'LIVE' : sessionStarted ? 'PAUSED' : 'IDLE'}</span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-[10px]">
          <TickerItem label="SESSION" value={`$${currentIncome.toFixed(4)}`} />
          <TickerItem label="EFF.RATE" value={`$${effectiveRate.toFixed(3)}/hr`} change={rateChange} />
          <TickerItem label="TODAY" value={`$${todayIncome.toFixed(3)}`} neutral />
          <TickerItem label="TOTAL" value={`$${totalIncome.toFixed(3)}`} neutral />
          <TickerItem label="STREAK" value={`${streak}d`} neutral />
          <TickerItem label="RATE/HR" value={`$${ratePerHour.toFixed(2)}`} neutral />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[9px] text-[#334]">
            <Wifi size={10} />
            <span className="tabular-nums">{now.toLocaleTimeString()}</span>
          </div>
          <button
            onClick={async () => {
              if (notifyStatus === 'sending') return
              const next = !notifyOn
              setNotifyOn(next)
              setNotifyStatus('sending')
              try {
                await notify(user, project, currentIncome, activeSeconds, effectiveRate, streak, isHigh, next)
                setNotifyStatus('done')
                setTimeout(() => setNotifyStatus('idle'), 3000)
              } catch (e) {
                setNotifyStatus('error')
                setTimeout(() => setNotifyStatus('idle'), 4000)
              }
            }}
            title={notifyOn ? 'Turn off & notify Slack' : 'Turn on & notify Slack'}
            className={`flex items-center gap-1 text-[9px] border px-2 py-1 rounded transition-all
              ${notifyOn
                ? notifyStatus === 'done' ? 'text-[#00ff88] border-[#00ff8844] bg-[#00ff8811]'
                : notifyStatus === 'error' ? 'text-[#ff3366] border-[#ff336644]'
                : notifyStatus === 'sending' ? 'text-[#ffd700] border-[#ffd70044]'
                : 'text-[#0088ff] border-[#0088ff]/40 bg-[#0088ff]/10'
                : 'text-[#445] border-[#1a2540] hover:text-[#0088ff] hover:border-[#0088ff]/40'}`}>
            {notifyStatus === 'sending'
              ? <Loader size={10} className="animate-spin" />
              : notifyOn ? <Bell size={10} /> : <BellOff size={10} />}
            {notifyStatus === 'sending' ? 'SENDING…'
              : notifyStatus === 'done' ? 'SENT ✓'
              : notifyStatus === 'error' ? 'FAILED'
              : notifyOn ? 'NOTIFY' : 'NOTIFY'}
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-1 text-[9px] text-[#445] hover:text-[#ff3366] border border-[#1a2540] hover:border-[#ff336633] px-2 py-1 rounded transition-colors">
            <LogOut size={10} /> OUT
          </button>
        </div>
      </div>

      {/* ── ALERT BARS (below header, in-flow) ── */}
      {(isLow || streakAtRisk) && (
        <div className="relative z-10">
          {isLow && (
            <div className={`flex items-center justify-center gap-2 py-1 text-[10px] font-bold transition-opacity duration-150 ${alertBlink ? 'opacity-100' : 'opacity-20'}`}
              style={{ background: 'linear-gradient(90deg,#ff003308,#ff003344,#ff003308)', borderBottom: '1px solid #ff003333' }}>
              <AlertTriangle size={11} className="text-[#ff0033]" />
              <span className="text-[#ff0033] tracking-[0.2em]">LOW PRODUCTIVITY — EFFECTIVE RATE BELOW AVERAGE</span>
              <AlertTriangle size={11} className="text-[#ff0033]" />
            </div>
          )}
          {streakAtRisk && (
            <div className={`flex items-center justify-center gap-2 py-1 text-[10px] font-bold transition-opacity duration-150 ${streakBlink ? 'opacity-100' : 'opacity-30'}`}
              style={{ background: 'linear-gradient(90deg,#ffd70008,#ffd70033,#ffd70008)', borderBottom: '1px solid #ffd70033' }}>
              <Clock size={11} className="text-[#ffd700]" />
              <span className="text-[#ffd700] tracking-[0.2em]">
                STREAK AT RISK — {todayJournalHours.toFixed(1)}h logged today (need 1h to protect {streak}-day streak)
              </span>
              <Clock size={11} className="text-[#ffd700]" />
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 p-4 max-w-screen-xl mx-auto">
        <div className="grid grid-cols-12 gap-4">

          {/* LEFT */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* User card */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4 flex items-center gap-3">
              {user.image && <img src={user.image} alt="" className="w-10 h-10 rounded-full border border-[#1a2540]" />}
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-bold">@{user.username}</div>
                <div className="text-[#445] text-[10px]">slack: {user.slack_id}</div>
                <div className="text-[#445] text-[10px]">top streak: {user.top_streak_days}d · {user.projects?.length} project(s)</div>
              </div>
              {streakAtRisk && (
                <div className={`flex-shrink-0 text-[#ffd700] transition-opacity ${streakBlink ? 'opacity-100' : 'opacity-30'}`}>
                  <Clock size={18} />
                </div>
              )}
            </div>

            {/* Project selector */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4">
              <div className="text-[10px] text-[#445] tracking-widest uppercase mb-2">Active Project</div>
              <select
                value={selectedProjectId || ''}
                onChange={e => setSelectedProjectId(Number(e.target.value))}
                className="w-full bg-[#060b18] border border-[#1a2540] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00ff88] mb-3"
              >
                {user.projects?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {project && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {project.thumbnail_url && (
                      <img src={project.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover border border-[#1a2540]" />
                    )}
                    <div>
                      <div className="text-white text-xs font-bold leading-tight">{project.name}</div>
                      <div className="text-[#445] text-[10px] mt-0.5">{project.type} · {project.fruit}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    <MiniStat label="STREAK" value={`${streak}d`} color="#00ff88" />
                    <MiniStat label="LEVEL" value={`L${level}`} color="#0088ff" />
                    <MiniStat label="STAGE" value={`S${project.stage}`} color="#ffd700" />
                    <MiniStat label="BASE/HR" value={`$${getLevelRate(level).toFixed(1)}`} color="#cc88ff" />
                  </div>
                  <div className="text-[10px] bg-[#060b18] rounded p-2 border border-[#1a2540]">
                    <span className="text-[#445]">RATE: </span>
                    <span className="text-[#cc88ff]">${getLevelRate(level).toFixed(1)}</span>
                    <span className="text-[#445]"> × (1 + </span>
                    <span className="text-[#00ff88]">{streak}</span>
                    <span className="text-[#445]">×0.01) = </span>
                    <span className="text-white font-bold">${ratePerHour.toFixed(3)}/hr</span>
                  </div>

                  {/* Today's journal hours */}
                  <div className={`mt-2 flex items-center justify-between text-[10px] px-2 py-1.5 rounded border ${todayJournalHours >= 1 ? 'border-[#00ff8822] text-[#00ff88]' : 'border-[#ffd70022] text-[#ffd700]'}`}
                    style={{ background: todayJournalHours >= 1 ? 'rgba(0,255,136,0.03)' : 'rgba(255,215,0,0.03)' }}>
                    <span>{todayJournalHours >= 1 ? '✓ Streak safe' : '⚠ Log needed'}</span>
                    <span className="font-bold">{todayJournalHours.toFixed(1)}h / 1h today</span>
                  </div>
                </div>
              )}
            </div>

            {/* Timer */}
            <div className={`bg-[#0a1020] border rounded p-5 relative overflow-hidden transition-all duration-300
              ${isLow && alertBlink ? 'border-[#ff003355]' : isRunning ? 'border-[#00ff8833]' : sessionStarted ? 'border-[#ffd70033]' : 'border-[#1a2540]'}`}>

              {isLow && (
                <div className={`absolute top-2 right-2 flex items-center gap-1 text-[#ff0033] text-[9px] transition-opacity ${alertBlink ? 'opacity-100' : 'opacity-20'}`}>
                  <AlertTriangle size={10} /> LOW
                </div>
              )}

              <div className="text-center mb-5">
                <div className="text-[9px] text-[#334] tracking-widest mb-1">ACTIVE TIME</div>
                <div className={`text-5xl font-bold tracking-wider transition-colors duration-300
                  ${isRunning && isHigh ? 'text-[#00ff88]' : isRunning ? 'text-[#ff3366]' : sessionStarted ? 'text-[#ffd700]' : 'text-[#223]'}`}>
                  {formatTime(activeSeconds)}
                </div>
                {sessionStarted && <div className="text-[9px] text-[#334] mt-1">wall: {formatTime(wallSeconds)}</div>}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-5">
                <StatBox label="INCOME" value={`$${currentIncome.toFixed(5)}`} color="#00ff88" />
                <StatBox label="EFF. RATE" value={`$${effectiveRate.toFixed(3)}/hr`}
                  color={isRunning ? (isHigh ? '#00ff88' : '#ff3366') : '#0088ff'}
                  sub={sessionStarted && rateChange !== 0 ? `${rateChange > 0 ? '▲' : '▼'} ${Math.abs(rateChange).toFixed(4)}` : null}
                  subColor={rateChange >= 0 ? '#00ff88' : '#ff3366'} />
                <StatBox label="AVG RATE" value={`$${avgRate.toFixed(3)}/hr`} color="#ffd700" />
                <StatBox label="STATUS"
                  value={
                    <span className="flex items-center gap-1" style={{ color: isRunning ? (isHigh ? '#00ff88' : '#ff3366') : '#334' }}>
                      {isRunning ? (isHigh ? <TrendingUp size={13} /> : <TrendingDown size={13} />) : null}
                      {isRunning ? (isHigh ? 'BULL' : 'BEAR') : sessionStarted ? 'HOLD' : 'IDLE'}
                    </span>
                  } />
              </div>

              <div className="flex gap-2 justify-center">
                {!isRunning ? (
                  <button onClick={handleStart}
                    className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-bold bg-[#00ff88] text-black hover:bg-[#00dd77] transition-all">
                    <Play size={15} /> {sessionStarted ? 'RESUME' : 'START'}
                  </button>
                ) : (
                  <button onClick={handlePause}
                    className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-bold bg-[#ffd700] text-black hover:bg-[#eec900] transition-all">
                    <Pause size={15} /> PAUSE
                  </button>
                )}
                <button onClick={handleStop} disabled={activeSeconds === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-bold border border-[#0088ff] text-[#0088ff] hover:bg-[#0088ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  STOP
                </button>
                <button onClick={handleReset}
                  className="p-2.5 rounded border border-[#1a2540] text-[#334] hover:text-[#556] transition-all">
                  <RotateCcw size={15} />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-[9px] text-[#334]">
                  {sessionStarted && !isRunning && <span className="text-[#ffd700]">⏸ PAUSED — RATE DECAYING</span>}
                </div>
                <button onClick={() => setShowFormulaEditor(f => !f)}
                  className="flex items-center gap-1 text-[9px] text-[#334] hover:text-[#556] border border-[#1a2540] px-2 py-1 rounded">
                  <Edit2 size={9} /> FORMULA
                </button>
              </div>

              {showFormulaEditor && (
                <div className="mt-3 pt-3 border-t border-[#1a2540]">
                  <div className="text-[9px] text-[#445] mb-1">Custom — uses <code className="text-[#0088ff]">streak</code> and <code className="text-[#0088ff]">level</code></div>
                  <div className="flex gap-2">
                    <input type="text" value={customFormula} onChange={e => setCustomFormula(e.target.value)}
                      placeholder="streak * 1.01 * level"
                      className="flex-1 bg-[#060b18] border border-[#1a2540] rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#0088ff]" />
                    <button onClick={() => { setFormula(customFormula || null); setShowFormulaEditor(false) }}
                      className="px-3 py-1.5 bg-[#0088ff] text-white text-xs rounded hover:bg-[#0066cc]">SET</button>
                    <button onClick={() => { setFormula(null); setShowFormulaEditor(false) }}
                      className="px-3 py-1.5 border border-[#1a2540] text-[#445] text-xs rounded">AUTO</button>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-record indicator */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={11} className={sessionStarted ? 'text-[#00ff88] animate-pulse' : 'text-[#1a2540]'} />
                <span className="text-[9px] text-[#334]">AUTO-RECORDING {sessionStarted ? (isRunning ? 'LIVE' : 'HOLD') : 'OFF'}</span>
              </div>
              <span className="text-[9px] text-[#334]">{liveChart.length} pts</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">

            {/* Live Income Chart */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#445] tracking-widest uppercase">Live Income Feed</span>
                  {sessionStarted && <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[#00ff88] animate-pulse' : 'bg-[#ff3366]'}`} />}
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <span style={{ color: isRunning ? '#00ff88' : sessionStarted ? '#ff3366' : '#445' }}>
                    ${currentIncome.toFixed(6)}
                  </span>
                  {!isRunning && sessionStarted && <span className="text-[#ff3366] text-[9px]">⏸ PAUSED</span>}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={liveChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="incGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="incRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff3366" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ff3366" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="t" stroke="#1a2540" tick={{ fontSize: 8, fill: '#334' }} interval="preserveStartEnd" />
                  <YAxis stroke="#1a2540" tick={{ fontSize: 8, fill: '#334' }} width={60} tickFormatter={v => `$${v.toFixed(5)}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#080d1a', border: '1px solid #1a2540', borderRadius: 4, fontSize: 9 }}
                    labelStyle={{ color: '#445' }} formatter={v => [`$${Number(v).toFixed(7)}`, 'Income']} />
                  <Area type="monotone" dataKey="income"
                    stroke={isRunning ? '#00ff88' : sessionStarted ? '#ff3366' : '#00ff88'}
                    strokeWidth={1.5}
                    fill={isRunning ? 'url(#incGreen)' : sessionStarted ? 'url(#incRed)' : 'url(#incGreen)'}
                    dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Effective Rate Chart */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-[#445] tracking-widest uppercase">Effective Rate / Hr</span>
                <span className={`text-[10px] font-bold ${isRunning ? (isHigh ? 'text-[#00ff88]' : 'text-[#ff3366]') : 'text-[#ffd700]'}`}>
                  ${effectiveRate.toFixed(4)}/hr
                </span>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={liveChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="t" stroke="#1a2540" tick={{ fontSize: 8, fill: '#334' }} interval="preserveStartEnd" />
                  <YAxis stroke="#1a2540" tick={{ fontSize: 8, fill: '#334' }} width={55} tickFormatter={v => `$${v.toFixed(2)}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#080d1a', border: '1px solid #1a2540', borderRadius: 4, fontSize: 9 }}
                    formatter={(v, _, p) => [`$${Number(v).toFixed(4)}/hr${p.payload?.paused ? ' ⏸' : ''}`, 'Rate']} />
                  <ReferenceLine y={avgRate} stroke="#ffd70044" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="rate"
                    stroke={isRunning ? (isHigh ? '#00ff88' : '#ff3366') : sessionStarted ? '#ff3366' : '#ffd700'}
                    strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-8 h-px border-t border-dashed border-[#ffd700] opacity-50" />
                <span className="text-[9px] text-[#334]">avg ${avgRate.toFixed(3)}/hr</span>
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-[#445] tracking-widest uppercase">Session Ledger</span>
                <span className="text-[9px] text-[#334]">{sessions.length} SESSIONS · ${totalIncome.toFixed(3)} TOTAL</span>
              </div>
              {sessions.length === 0 ? (
                <div className="text-center py-5 text-[#223] text-xs">Start a session to begin tracking</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-[#1a2540]">
                        {['DATE', 'TIME', 'PROJECT', 'DURATION', 'INCOME', 'EFF.RATE', 'L', 'STREAK'].map(h => (
                          <th key={h} className="text-left p-2 text-[#334] tracking-wider font-normal">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...sessions].reverse().slice(0, 20).map(s => (
                        <tr key={s.id} className="border-b border-[#0d1428] hover:bg-[#0d1428] transition-colors">
                          <td className="p-2 text-[#334]">{s.timestamp}</td>
                          <td className="p-2 text-[#334]">{s.time}</td>
                          <td className="p-2 text-[#0088ff] truncate max-w-[90px]">{s.projectName || '—'}</td>
                          <td className="p-2 text-[#445]">{formatTime(s.duration)}</td>
                          <td className="p-2 text-[#00ff88] font-bold">${s.income.toFixed(4)}</td>
                          <td className="p-2 text-[#0088ff]">${s.ratePerHour.toFixed(3)}/hr</td>
                          <td className="p-2 text-[#cc88ff]">L{s.level}</td>
                          <td className="p-2 text-[#ffd700]">{s.streak}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Journals */}
            {project?.journals?.length > 0 && (
              <div className="bg-[#0a1020] border border-[#1a2540] rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-[#445] tracking-widest uppercase">Project Journal — {project.name}</span>
                  <span className="text-[10px] text-[#ffd700]">{totalJournalHours}h logged · {project.journals.length} entries</span>
                </div>
                <div className="max-h-56 overflow-y-auto pr-1">
                  {project.journals.map(j => {
                    const brief = briefText(j.short_brief)
                    const isToday = j.created_at?.slice(0, 10) === todayStr
                    return (
                      <div key={j.id} className={`py-2.5 border-b border-[#0d1428] flex items-start gap-3 ${isToday ? 'bg-[#00ff880a] -mx-1 px-1 rounded' : ''}`}>
                        {j.author_image && <img src={j.author_image} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 border border-[#1a2540]" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] text-[#445]">@{j.author_username}</span>
                            <span className="text-[9px] text-[#223]">·</span>
                            <span className="text-[9px] text-[#334]">{new Date(j.created_at).toLocaleDateString()}</span>
                            {isToday && <span className="text-[9px] text-[#00ff88] border border-[#00ff8833] px-1 rounded">TODAY</span>}
                          </div>
                          {brief && <p className="text-[11px] text-[#667] leading-snug break-words">{brief}</p>}
                        </div>
                        <div className="text-[#00ff88] text-xs font-bold flex-shrink-0">{j.hours}h</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color, sub, subColor }) {
  return (
    <div className="bg-[#060b18] border border-[#1a2540] rounded p-2.5">
      <div className="text-[8px] tracking-widest mb-1 text-[#334]">{label}</div>
      <div className="text-xs font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px] mt-0.5" style={{ color: subColor }}>{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-[#060b18] border border-[#1a2540] rounded p-2 text-center">
      <div className="font-bold text-sm" style={{ color }}>{value}</div>
      <div className="text-[8px] text-[#334] tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function TickerItem({ label, value, change, neutral }) {
  const up = change > 0, down = change < 0
  return (
    <div className="flex items-center gap-1">
      <span className="text-[#334]">{label}</span>
      <span className={`font-bold tabular-nums ${neutral ? 'text-white' : up ? 'text-[#00ff88]' : down ? 'text-[#ff3366]' : 'text-white'}`}>{value}</span>
      {!neutral && change !== undefined && change !== 0 && (
        up ? <ChevronUp size={9} className="text-[#00ff88]" /> : <ChevronDown size={9} className="text-[#ff3366]" />
      )}
    </div>
  )
}
