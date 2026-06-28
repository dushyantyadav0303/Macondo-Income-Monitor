import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Play, Pause, RotateCcw, Plus, Edit2, TrendingUp, TrendingDown } from 'lucide-react';

export default function IncomeMonitor() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [historicalData, setHistoricalData] = useState([]);
  const [formula, setFormula] = useState('7 * 0.01 * streak');
  const [streak, setStreak] = useState(1);
  const [showFormulaEditor, setShowFormulaEditor] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [addIncomeAmount, setAddIncomeAmount] = useState('');
  const [sessions, setSessions] = useState([]);
  const timerRef = useRef(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('incomeMonitorData');
    const savedSessions = localStorage.getItem('incomeMonitorSessions');
    if (savedData) {
      const data = JSON.parse(savedData);
      setHistoricalData(data.historicalData || []);
      setFormula(data.formula || '7 * 0.01 * streak');
      setStreak(data.streak || 1);
    }
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('incomeMonitorData', JSON.stringify({
      historicalData,
      formula,
      streak
    }));
    localStorage.setItem('incomeMonitorSessions', JSON.stringify(sessions));
  }, [historicalData, formula, streak, sessions]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const calculateIncome = (seconds) => {
    const hours = seconds / 3600;
    try {
      const income = eval(formula.replace('streak', streak));
      return income * hours;
    } catch {
      return 7 * hours * 0.01 * streak;
    }
  };

  const currentIncome = calculateIncome(elapsedSeconds);
  const hoursElapsed = elapsedSeconds / 3600;
  const incomePerHour = hoursElapsed > 0 ? currentIncome / hoursElapsed : 0;

  // Productivity calculation
  const avgProductivity = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.incomePerHour, 0) / sessions.length 
    : 7 * 0.01 * streak;
  const isHighProductivity = incomePerHour > avgProductivity * 0.9;

  const handleStop = () => {
    setIsRunning(false);
    if (elapsedSeconds > 0) {
      const newSession = {
        id: Date.now(),
        duration: elapsedSeconds,
        income: currentIncome,
        incomePerHour,
        timestamp: new Date().toLocaleDateString(),
        streak
      };
      setSessions([...sessions, newSession]);
      
      // Add to historical data for chart
      const newData = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        income: currentIncome,
        cumulativeIncome: (historicalData[historicalData.length - 1]?.cumulativeIncome || 0) + currentIncome,
        incomePerHour
      };
      setHistoricalData([...historicalData, newData]);
      
      // Update streak
      setStreak(streak + 0.1);
    }
    setElapsedSeconds(0);
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
  };

  const handleAddIncome = () => {
    if (addIncomeAmount) {
      const amount = parseFloat(addIncomeAmount);
      const newSession = {
        id: Date.now(),
        duration: 0,
        income: amount,
        incomePerHour: 0,
        timestamp: new Date().toLocaleDateString(),
        manual: true
      };
      setSessions([...sessions, newSession]);
      setAddIncomeAmount('');
      setShowAddIncome(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalIncome = historicalData.reduce((sum, d) => sum + d.income, 0) + 
                      sessions.reduce((sum, s) => sum + s.income, 0);
  
  const todayIncome = sessions
    .filter(s => s.timestamp === new Date().toLocaleDateString())
    .reduce((sum, s) => sum + s.income, 0);

  const monthlyIncome = sessions.reduce((sum, s) => sum + s.income, 0) + 
                        historicalData.reduce((sum, d) => sum + d.income, 0);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1535] to-[#1a1f3a] relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,255,136,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-mono tracking-wider">INCOME MONITOR</h1>
          <div className="h-1 w-40 bg-gradient-to-r from-[#00ff88] to-transparent" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Stopwatch Section */}
          <div className="lg:col-span-2">
            <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-8 backdrop-blur-sm">
              {/* Timer Display */}
              <div className="text-center mb-8">
                <div className={`text-7xl font-bold font-mono mb-4 transition-all duration-300 ${
                  isHighProductivity ? 'text-[#00ff88]' : 'text-[#0088ff]'
                }`}>
                  {formatTime(elapsedSeconds)}
                </div>
                
                {/* Income Display */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-[#0f1535] border border-[#00ff88]/30 rounded p-4">
                    <div className="text-[#00ff88] text-sm font-mono mb-1">CURRENT</div>
                    <div className="text-2xl font-bold text-white font-mono">${currentIncome.toFixed(2)}</div>
                  </div>
                  <div className="bg-[#0f1535] border border-[#0088ff]/30 rounded p-4">
                    <div className="text-[#0088ff] text-sm font-mono mb-1">PER HOUR</div>
                    <div className="text-2xl font-bold text-white font-mono">${incomePerHour.toFixed(2)}</div>
                  </div>
                  <div className={`bg-[#0f1535] border rounded p-4 ${
                    isHighProductivity ? 'border-[#00ff88]/30' : 'border-[#ff3366]/30'
                  }`}>
                    <div className={`text-sm font-mono mb-1 ${isHighProductivity ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                      STATUS
                    </div>
                    <div className={`text-2xl font-bold font-mono flex items-center justify-center gap-2 ${
                      isHighProductivity ? 'text-[#00ff88]' : 'text-[#ff3366]'
                    }`}>
                      {isHighProductivity ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      {isHighProductivity ? 'HIGH' : 'LOW'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-4 justify-center mb-6">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className={`flex items-center gap-2 px-6 py-3 rounded font-bold transition-all border ${
                    isRunning
                      ? 'bg-[#ff3366] border-[#ff3366] text-white hover:bg-[#ff1a4d]'
                      : 'bg-[#00ff88] border-[#00ff88] text-black hover:bg-[#00dd77]'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause size={20} /> PAUSE
                    </>
                  ) : (
                    <>
                      <Play size={20} /> START
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleStop}
                  disabled={elapsedSeconds === 0 && !isRunning}
                  className="flex items-center gap-2 px-6 py-3 rounded font-bold transition-all border border-[#0088ff] bg-[#0088ff]/10 text-[#0088ff] hover:bg-[#0088ff]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  SAVE
                </button>
                
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-6 py-3 rounded font-bold transition-all border border-[#666] bg-[#666]/10 text-[#999] hover:bg-[#666]/20"
                >
                  <RotateCcw size={20} /> RESET
                </button>
              </div>

              {/* Streak Display */}
              <div className="text-center text-[#00ff88] font-mono text-sm">
                STREAK: {streak.toFixed(2)}x MULTIPLIER
              </div>
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-6 backdrop-blur-sm">
              <div className="text-[#00ff88] text-xs font-mono mb-2 uppercase tracking-widest">Today</div>
              <div className="text-3xl font-bold text-white font-mono mb-4">${todayIncome.toFixed(2)}</div>
              <div className="h-0.5 bg-[#00ff88]/20 mb-4" />
              
              <div className="text-[#0088ff] text-xs font-mono mb-2 uppercase tracking-widest">Month</div>
              <div className="text-3xl font-bold text-white font-mono">${monthlyIncome.toFixed(2)}</div>
            </div>

            <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-6 backdrop-blur-sm">
              <div className="text-[#00ff88] text-xs font-mono mb-2 uppercase tracking-widest">Total</div>
              <div className="text-3xl font-bold text-white font-mono">${totalIncome.toFixed(2)}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddIncome(!showAddIncome)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded font-bold transition-all border border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20"
              >
                <Plus size={18} /> ADD
              </button>
              <button
                onClick={() => setShowFormulaEditor(!showFormulaEditor)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded font-bold transition-all border border-[#0088ff] bg-[#0088ff]/10 text-[#0088ff] hover:bg-[#0088ff]/20"
              >
                <Edit2 size={18} /> EDIT
              </button>
            </div>
          </div>
        </div>

        {/* Add Income Modal */}
        {showAddIncome && (
          <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-6 backdrop-blur-sm mb-8">
            <h3 className="text-[#00ff88] font-mono font-bold mb-4 uppercase tracking-widest">Add Previous Income</h3>
            <div className="flex gap-3">
              <input
                type="number"
                step="0.01"
                placeholder="Amount ($)"
                value={addIncomeAmount}
                onChange={(e) => setAddIncomeAmount(e.target.value)}
                className="flex-1 bg-[#0f1535] border border-[#00ff88]/20 rounded px-4 py-2 text-white font-mono focus:outline-none focus:border-[#00ff88]"
              />
              <button
                onClick={handleAddIncome}
                className="px-6 py-2 rounded font-bold bg-[#00ff88] text-black hover:bg-[#00dd77]"
              >
                ADD
              </button>
            </div>
          </div>
        )}

        {/* Formula Editor Modal */}
        {showFormulaEditor && (
          <div className="bg-[#1a1f3a] border border-[#0088ff]/20 rounded-lg p-6 backdrop-blur-sm mb-8">
            <h3 className="text-[#0088ff] font-mono font-bold mb-4 uppercase tracking-widest">Edit Income Formula</h3>
            <p className="text-[#999] text-sm mb-4 font-mono">
              Use 'streak' variable. Example: 7 * 0.01 * streak
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Formula (e.g., 7 * 0.01 * streak)"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className="flex-1 bg-[#0f1535] border border-[#0088ff]/20 rounded px-4 py-2 text-white font-mono focus:outline-none focus:border-[#0088ff]"
              />
              <button
                onClick={() => setShowFormulaEditor(false)}
                className="px-6 py-2 rounded font-bold bg-[#0088ff] text-white hover:bg-[#0066dd]"
              >
                DONE
              </button>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Income Over Time Chart */}
          {historicalData.length > 0 && (
            <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-[#00ff88] font-mono font-bold mb-4 uppercase tracking-widest">Income Timeline</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.1)" />
                  <XAxis dataKey="time" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f1535', border: '1px solid #00ff88', borderRadius: '8px' }}
                    labelStyle={{ color: '#00ff88' }}
                    formatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#00ff88" 
                    strokeWidth={2}
                    dot={{ fill: '#00ff88', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Income Per Hour Chart */}
          {sessions.filter(s => !s.manual).length > 0 && (
            <div className="bg-[#1a1f3a] border border-[#0088ff]/20 rounded-lg p-6 backdrop-blur-sm">
              <h3 className="text-[#0088ff] font-mono font-bold mb-4 uppercase tracking-widest">Productivity</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessions.filter(s => !s.manual)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,136,255,0.1)" />
                  <XAxis dataKey="timestamp" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f1535', border: '1px solid #0088ff', borderRadius: '8px' }}
                    labelStyle={{ color: '#0088ff' }}
                    formatter={(value) => `$${value.toFixed(2)}/hr`}
                  />
                  <Bar dataKey="incomePerHour" fill="#0088ff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sessions Report */}
        {sessions.length > 0 && (
          <div className="bg-[#1a1f3a] border border-[#00ff88]/20 rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-[#00ff88] font-mono font-bold mb-4 uppercase tracking-widest">Session Report</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-[#00ff88]/20">
                    <th className="text-left p-3 text-[#00ff88]">Date</th>
                    <th className="text-left p-3 text-[#0088ff]">Duration</th>
                    <th className="text-left p-3 text-[#00ff88]">Income</th>
                    <th className="text-left p-3 text-[#0088ff]">Per Hour</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-[#00ff88]/10 hover:bg-[#0f1535] transition">
                      <td className="p-3 text-white">{session.timestamp}</td>
                      <td className="p-3 text-[#0088ff]">{formatTime(session.duration)}</td>
                      <td className="p-3 text-[#00ff88]">${session.income.toFixed(2)}</td>
                      <td className="p-3 text-[#0088ff]">${session.incomePerHour.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sessions.length === 0 && historicalData.length === 0 && (
          <div className="text-center py-16">
            <div className="text-[#666] font-mono text-lg">
              Start tracking to see your income data
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
