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

  const prompt = `Write a super friendly, hype Slack message (2-3 sentences max, like texting a close friend, casual AF) for a Hack Club member who ${action}:

@${username} | Project: ${projectName} | Session: ${hours}h 💪 | Earned: $${sessionIncome.toFixed(3)} ${perf} | Rate: $${ratePerHour.toFixed(2)}/hr | Streak: ${streak}d 🔥 | ${isHigh ? 'CRUSHING IT 🚀' : 'needs some vibes 🌙'}

${notifyEnabled 
  ? `They just ENABLED notifications! Hype them up hard, mention their session money & project name. Use: ${motivation}. React like you're texting a friend who's doing amazing.` 
  : `They disabled notifications. No worries, give them a chill summary. Maybe make them laugh with JASDJFAJSFJAJSDFJ or :uuh: :loll: :cryin:`
}

${userEmoji ? `Extra special vibe for @${username}: ${userEmoji}` : ''}

Be genuine and excited, use their actual numbers, mention the project by name. No hashtags. Make them feel like you're genuinely hyped about what they're building!`

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
  const { perf, motivation } = getPerformanceEmojis(true) // Auto messages are celebratory
  
  switch (type) {
    case 'session_start':
      return `Write a super hype, energetic Slack message (2 sentences, like a friend cheering you on, casual) for a Hack Club member who just started a coding session:
User: @${username} | Project: ${projectName} | Rate: $${ratePerHour.toFixed(2)}/hr | Streak: ${streak}d
Make them feel pumped to start! Mention the project name. Use emojis like :yayayayayay: or :macondo:. React like you're excited they're about to make money. No hashtags.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    case 'session_stop':
      return `Write a celebratory, hyped Slack message (2-3 sentences, genuine and excited, like a best friend) for a Hack Club member who just crushed a coding session:
User: @${username} | Project: ${projectName} | Session: ${hours}h, earned $${sessionIncome.toFixed(3)}, avg rate $${ratePerHour.toFixed(2)}/hr | Streak: ${streak}d
Go HARD celebrating them! Mention how much they earned and the project name. Use: ${motivation} or :yayayayayay:. Make them feel like an absolute legend. No hashtags.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    case 'long_pause':
      return `Write an encouraging, gentle Slack message (2 sentences, like a supportive friend, NOT scolding) for a Hack Club member whose session has been paused for ${extra?.minutes} minutes:
User: @${username} | Project: ${projectName} | Session so far: ${hours}h, earned $${sessionIncome.toFixed(3)} | Streak: ${streak}d
Remind them they're doing great and to come back for a quick push. Be warm and supportive. Use: :uuh: or :loll:. No hashtags.`
    
    case 'streak_risk':
      return `Write an URGENT but friendly Slack message (2-3 sentences, like a friend giving you a heads up, NOT mean) for a Hack Club member whose ${streak}-day streak is about to disappear because they haven't logged 1 hour today:
User: @${username} | Project: ${projectName} | Today logged: ${extra?.todayHours}h | Hours left in day: ${extra?.hoursLeft}h | Streak at risk!
Make them feel the urgency but also hyped to save it! Use: :skull: or :yayayayayay:. Mention the streak is on the line. Be motivating. No hashtags.`
    
    case 'streak_safe':
      return `Write an EXTREMELY celebratory, hype Slack message (2-3 sentences, pure celebration, like your best friend just won) for a Hack Club member who just saved their ${streak}-day streak by logging 1+ hour today:
User: @${username} | Project: ${projectName} | Today logged: ${extra?.todayHours}h | STREAK SAVED! 🔥
GO ABSOLUTELY WILD celebrating them! Use: ${motivation} :blobhaj_party: :macondo: JASDJFAJSFJAJSDFJ. Make them feel like champions. No hashtags.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    case 'milestone':
      return `Write an exciting, celebratory Slack message (2-3 sentences, like your friend hit a personal record) for a Hack Club member who just hit ${extra?.hours} hours of active work in their session:
User: @${username} | Project: ${projectName} | Session income: $${sessionIncome.toFixed(3)}, rate $${ratePerHour.toFixed(2)}/hr | Streak: ${streak}d | MILESTONE! 🚀
Celebrate HARD! This is huge! Use: ${motivation} :yayayayayay:. Mention the project and how much they earned. No hashtags.${userEmoji ? ` Add: ${userEmoji}` : ''}`
    
    default:
      return `Write a super friendly Slack message for @${username} about their session on ${projectName}. Keep it casual and genuine!`
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

export async function sendSlack(channelId, text, slackId) {
  const mention = slackId ? `<@${slackId}> ` : ''
  const res = await fetch('/api/slack-proxy/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text: mention + text }),
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
  await sendSlack(user.slack_id, msg, user.slack_id)
  return msg
}

export async function autoNotify(type, user, project, sessionIncome, activeSeconds, ratePerHour, streak, isHigh, extra) {
  const msg = await generateAutoMessage({
    username: user.username,
    projectName: project?.name || 'project',
    sessionIncome, activeSeconds, ratePerHour, streak, type, extra,
  })
  await sendSlack(user.slack_id, msg, user.slack_id)
  return msg
}