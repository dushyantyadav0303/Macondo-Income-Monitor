export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.pathname.replace('/api/hackclub-ai', '') || '/chat/completions'
  const target = `https://ai.hackclub.com/proxy/v1${path}`

  const headers = { 'Content-Type': 'application/json' }
  const key = process.env.VITE_HACKCLUB_AI_KEY
  if (key) headers['Authorization'] = `Bearer ${key}`

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: req.method !== 'GET' ? req.body : undefined,
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
