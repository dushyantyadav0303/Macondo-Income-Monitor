export const config = { runtime: 'edge' }

export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || 'chat.postMessage'
  const target = `https://slack.com/api/${path}`

  const res = await fetch(target, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('Authorization') || `Bearer ${process.env.VITE_SLACK_BOT_TOKEN}`,
    },
    body: req.method !== 'GET' ? req.body : undefined,
  })

  const data = await res.json()
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
