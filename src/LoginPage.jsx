import { useState } from 'react'
import { LogIn, Loader, AlertCircle, Zap, HelpCircle, X } from 'lucide-react'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function extractUUID(input) {
  const m = input.match(UUID_RE)
  return m ? m[0] : null
}

function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-[#0a1020] border border-[#1a2540] rounded-lg p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-[#445] hover:text-white transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={16} className="text-[#00ff88]" />
          <span className="text-white text-sm font-bold tracking-wider">How to find your Profile ID</span>
        </div>
        <ol className="space-y-3 text-[11px] text-[#667]">
          <li className="flex gap-2">
            <span className="text-[#00ff88] font-bold flex-shrink-0">1.</span>
            <span>Go to <code className="text-[#0088ff]">macondo.hackclub.com</code> and log in with your Hack Club account.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#00ff88] font-bold flex-shrink-0">2.</span>
            <span>Click on your profile icon/avatar in the top-right corner to open your profile page.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#00ff88] font-bold flex-shrink-0">3.</span>
            <span>Look at the browser URL — it will look like:<br />
              <code className="text-[#ffd700] break-all">macondo.hackclub.com/u/c7242f92-916e-4ff9-9c69-631ed9dfc970</code>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#00ff88] font-bold flex-shrink-0">4.</span>
            <span>Copy either the <strong className="text-white">full URL</strong> or just the <strong className="text-white">UUID</strong> part after <code className="text-[#0088ff]">/u/</code> and paste it in the field below.</span>
          </li>
        </ol>
        <div className="mt-4 bg-[#060b18] border border-[#1a2540] rounded p-3 text-[10px] text-[#445]">
          <div className="text-[#334] mb-1">You can paste any of these formats:</div>
          <div className="text-[#0088ff] break-all">https://macondo.hackclub.com/u/your-uuid</div>
          <div className="text-[#0088ff] break-all">https://macondo.hackclub.com/api/users/your-uuid</div>
          <div className="text-[#0088ff]">your-uuid-only</div>
        </div>
        <button onClick={onClose}
          className="mt-4 w-full py-2 rounded bg-[#00ff88] text-black text-xs font-bold hover:bg-[#00dd77] transition-colors">
          GOT IT
        </button>
      </div>
    </div>
  )
}

export default function LoginPage({ onLogin }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const handleLogin = async () => {
    const raw = input.trim()
    if (!raw) return
    const uuid = extractUUID(raw)
    if (!uuid) {
      setError('Could not find a valid UUID in your input. Paste your profile ID or the full API URL.')
      return
    }
    setLoading(true)
    setError('')
    try {
      setStep('Fetching profile…')
      const userRes = await fetch(`/api/users/${uuid}`)
      if (!userRes.ok) throw new Error(`User not found (HTTP ${userRes.status})`)
      const userData = await userRes.json()

      setStep(`Found @${userData.username} — loading ${userData.projects?.length || 0} project(s)…`)

      const projectDetails = await Promise.all(
        (userData.projects || []).map(async (p) => {
          try {
            const r = await fetch(`/api/projects/${p.id}`)
            if (!r.ok) return { ...p, journals: [] }
            return await r.json()
          } catch {
            return { ...p, journals: [] }
          }
        })
      )

      onLogin({
        id: userData.id,
        username: userData.username,
        image: userData.image,
        slack_id: userData.slack_id,
        last_active_date: userData.last_active_date,
        top_streak_days: userData.top_streak_days,
        projects: projectDetails,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setStep('')
    }
  }

  return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center relative overflow-hidden font-mono">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Grid bg */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,255,136,0.04) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,255,136,0.03) 39px, rgba(0,255,136,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,255,136,0.03) 39px, rgba(0,255,136,0.03) 40px)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap size={28} className="text-[#00ff88]" />
            <span className="text-3xl font-bold tracking-[0.2em] text-white">INCOME<span className="text-[#00ff88]">/</span>MONITOR</span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#00ff88]/40 to-transparent" />
          <p className="text-[#334] text-xs tracking-widest mt-3 uppercase">Hackclub · Real-Time Earnings Tracker</p>
        </div>

        {/* Card */}
        <div className="bg-[#0a1020] border border-[#1a2540] rounded-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-[#445] tracking-widest uppercase">Profile ID or URL</label>
              <button onClick={() => setShowHelp(true)}
                className="flex items-center gap-1 text-[10px] text-[#445] hover:text-[#00ff88] transition-colors">
                <HelpCircle size={12} /> How to find?
              </button>
            </div>
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
              placeholder="paste UUID or macondo.hackclub.com/u/…"
              className="w-full bg-[#060b18] border border-[#1a2540] rounded px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff88] transition-colors placeholder-[#223]"
            />
            <p className="text-[#334] text-[10px] mt-2">
              Works with UUID only, <code className="text-[#0088ff]">/u/</code> URL, or full API URL
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-[#ff003311] border border-[#ff003333] rounded px-3 py-2 mb-4">
              <AlertCircle size={14} className="text-[#ff3366] flex-shrink-0 mt-0.5" />
              <span className="text-[#ff3366] text-xs">{error}</span>
            </div>
          )}

          {step && (
            <div className="flex items-center gap-2 text-[#00ff88] text-xs mb-4">
              <Loader size={12} className="animate-spin" />
              <span>{step}</span>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded bg-[#00ff88] text-black font-bold text-sm hover:bg-[#00dd77] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? 'CONNECTING…' : 'CONNECT'}
          </button>
        </div>

        <p className="text-center text-[#223] text-[10px] mt-6 tracking-widest">
          DATA FROM MACONDO · HACKCLUB
        </p>
      </div>
    </div>
  )
}
