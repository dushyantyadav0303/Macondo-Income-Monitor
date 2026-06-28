const SLACK_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN || ''
const AI_KEY = import.meta.env.VITE_HACKCLUB_AI_KEY || ''

export async function generateMessage({ username, projectName, sessionIncome, activeSeconds, ratePerHour, streak, isHigh, notifyEnabled }) {
  const hours = (activeSeconds / 3600).toFixed(2)
  const action = notifyEnabled ? 'just turned ON Slack notifications' : 'just turned OFF Slack notifications'
  const prompt = `Write a short Slack message (2 sentences, casual, 1-2 emojis) for a Hack Club member who ${action}:
User: @${username} | Project: ${projectName} | Session so far: ${hours}h, earned $${sessionIncome.toFixed(3)}, rate $${ratePerHour.toFixed(2)}/hr | Streak: ${streak}d | ${isHigh ? 'High productivity' : 'Below average — needs motivation'}
${notifyEnabled ? 'Acknowledge they enabled notifications and mention their current session stats.' : 'Acknowledge they disabled notifications and give a brief session summary.'}
Mention the project name and be specific to the numbers. No hashtags.`

  const headers = { 'Content-Type': 'application/json' }
  if (AI_KEY) headers['Authorization'] = `Bearer ${AI_KEY}`

  const res = await fetch('/hackclub-ai/chat/completions', {
    method: 'POST',
    headers,
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
  if (!SLACK_TOKEN) throw new Error('VITE_SLACK_BOT_TOKEN not set in Secrets')
  const res = await fetch('/slack-proxy/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SLACK_TOKEN}` },
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
