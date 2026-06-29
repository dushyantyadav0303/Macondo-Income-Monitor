export default async function handler(req, res) {
  const targetPath = req.url.replace(/^\/api\/hackclub-ai/, '') || '/'
  const target = `https://ai.hackclub.com/proxy/v1${targetPath}`

  const headers = { 'Content-Type': 'application/json' }
  const key = process.env.HACKCLUB_AI_KEY || process.env.VITE_HACKCLUB_AI_KEY || ''
  if (key) headers['Authorization'] = `Bearer ${key}`

  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
