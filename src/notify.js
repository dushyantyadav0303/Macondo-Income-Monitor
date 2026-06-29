// No secrets here — Slack token lives server-side on Vercel API routes
// Dev: Vite proxy forwards /api/slack-proxy and /api/hackclub-ai
// Prod: Vercel serverless functions inject the token

// User-specific emojis for special vibes
const userEmojis = {
  'notarooba': ':blobhaj_party:',
  'gabin': ':pet-gabin:',
  // Add more users as needed
}

// Emoji selector based on performance
function getPerformanceEmojis(isHigh) {
  return isHigh 
    ? { perf: ':money-printer: :macondo:', motivation: ':yayayayayay: aja' }
    : { perf: ':skull:', motivation: ':pf: perfect' }
}

export async function generateMessage({ username, projectName, sessionIncome, activeSeconds, ratePerHour, streak, isHigh, notifyEnabled }) {
  const hours = (activeSeconds / 3600).toFixed(2)
  const action = notifyEnabled ? 'just turned ON Slack notifications' : 'just turned OFF Slack notifications'
  const userEmoji = userEmojis[username] || ''
  const { perf, motivation } = getPerformanceEmojis(isHigh)

  const prompt = `Write a quick, friendly Slack message (max 1-2 sentences, casual) for a Hack Club member who ${action}:

@${username} | Project: ${projectName} | Session: ${hours}h | Earned: $${sessionIncome.toFixed(3)} | Streak: ${streak}d | ${isHigh ? 'Doing great' : 'Needs motivation'}

${notifyEnabled 
  ? `They enabled notifications! Keep it short & genuine. Mention the money & project. Use 1 emoji max like ${motivation}.` 
  : `They disabled notifications. Brief summary, chill vibe.`
}

${userEmoji ? `Add this for them: ${userEmoji}` : ''}

START with @${username} mention. No hashtags, mention numbers & project name. Keep it short & real. No 🔥 🚀 💪 emojis.`

  const res = await fetch('/api/hackclub-ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

function buildAutoPrompt({ username, projectName, sessionIncome, activeSeconds, ratePerHour, streak, type, extra }) {
  const hours = (activeSeconds / 3600).toFixed(2)
  const userEmoji = userEmojis[username] || ''
  
  switch (type) {
    case 'session_start':
      return `Quick 1-2 sentence Slack message for @${username} who just started working on ${projectName}. Rate: $${ratePerHour.toFixed(2)}/hr, streak ${streak}d. Be encouraging & brief. 1 emoji max. START with @${username}. No 🔥 🚀 💪 emojis.`
    
    case 'session_stop':
      return `Quick 1-2 sentence Slack message for @${username} who finished ${projectName}. Earned $${sessionIncome.toFixed(3)} in ${hours}h, streak ${streak}d. Congratulate them. 1 emoji max. START with @${username}. No 🔥 🚀 💪 emojis.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    case 'long_pause':
      return `Quick 1 sentence Slack message for @${username} paused on ${projectName} for ${extra?.minutes}min (${hours}h earned). Gently remind them to come back. Be supportive. 1 emoji max. START with @${username}. No 🔥 🚀 💪 emojis.`
    
    case 'streak_risk':
      return `Quick 1-2 sentence URGENT Slack message for @${username}. Their ${streak}-day streak ends today! They've logged ${extra?.todayHours}h, need 1+ hour. ${extra?.hoursLeft}h left in day. Be motivating. 1-2 emojis max. START with @${username}. No 🔥 🚀 💪 emojis.`
    
    case 'streak_safe':
      return `Quick 2 sentence celebratory Slack message for @${username}! They saved their ${streak}-day streak by logging ${extra?.todayHours}h today! Be excited. 1-2 emojis max. START with @${username}. No 🔥 🚀 💪 emojis.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    case 'milestone':
      return `Quick 1-2 sentence celebratory Slack message for @${username} hitting ${extra?.hours}h on ${projectName}! They earned $${sessionIncome.toFixed(3)}, streak ${streak}d. Be hyped. 1 emoji max. START with @${username}. No 🔥 🚀 💪 emojis.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    default:
      return `Write a brief, friendly Slack message for @${username} about ${projectName}. START with @${username}. No 🔥 🚀 💪 emojis.`
  }
}

export async function generateAutoMessage(args) {
  const prompt = buildAutoPrompt(args)
  const res = await fetch('/api/hackclub-ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export async function sendSlack(channelId, text) {
  const res = await fetch('/api/slack-proxy/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack: ${data.error}`)
}

export async function notify(user, project, sessionIncome, activeSeconds, ratePerHour, streak, isHigh, notifyEnabled) {
  const msg = await generateMessage({
    username: user.username,
    projectName: project?.name || 'project',
    sessionIncome, activeSeconds, ratePerHour, streak, isHigh, notifyEnabled,
  })
  await sendSlack(user.slack_id, msg)
  return msg
}

export async function autoNotify(type, user, project, sessionIncome, activeSeconds, ratePerHour, streak, isHigh, extra) {
  const msg = await generateAutoMessage({
    username: user.username,
    projectName: project?.name || 'project',
    sessionIncome, activeSeconds, ratePerHour, streak, type, extra,
  })
  await sendSlack(user.slack_id, msg)
  return msg
}