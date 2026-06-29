export default async function handler(req, res) {
  const targetPath = req.url.replace(/^\/api\/slack-proxy/, '') || '/'
  const target = `https://slack.com/api${targetPath}`

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN || process.env.VITE_SLACK_BOT_TOKEN || ''}`,
  }

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
