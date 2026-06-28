export default function handler(req, res) {
  const token = process.env.SLACK_BOT_TOKEN; // Regular env var, not VITE_
  
  // Forward request to Slack with token hidden server-side
  const response = await fetch('https://slack.com/api/' + req.url, {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: req.body
  });
  
  res.status(response.status).json(await response.json());
}
