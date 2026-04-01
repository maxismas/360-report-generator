export default async function handler(req, res) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] Request received: ${req.method}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(`[${requestId}] ERROR: ANTHROPIC_API_KEY not set`);
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body || !body.messages) {
      console.error(`[${requestId}] ERROR: Invalid request body:`, JSON.stringify(body).slice(0, 200));
      return res.status(400).json({ error: 'Invalid request body — messages array missing.' });
    }

    const employeeName = body._employeeName || 'unknown';
    const rowCount = body._rowCount || 'unknown';
    console.log(`[${requestId}] Generating report for: ${employeeName} | rows: ${rowCount}`);

    const { _employeeName, _rowCount, ...anthropicBody } = body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const text = await response.text();
    console.log(`[${requestId}] Anthropic response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[${requestId}] Anthropic error: ${text}`);
      return res.status(response.status).json({ error: text });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error(`[${requestId}] Failed to parse Anthropic response: ${text.slice(0, 500)}`);
      return res.status(500).json({ error: 'Invalid response from AI — could not parse JSON.' });
    }

    const content = parsed?.content?.[0]?.text || '';
    console.log(`[${requestId}] Claude response length: ${content.length} chars`);

    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      JSON.parse(cleaned);
      console.log(`[${requestId}] Report JSON valid — success`);
    } catch (e) {
      console.error(`[${requestId}] Claude returned invalid JSON. Preview: ${content.slice(0, 300)}`);
      return res.status(500).json({ error: 'AI returned malformed data. Please try again.' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error(`[${requestId}] Unhandled error: ${err.message}`, err.stack);
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  api: {
    bodyParser: true,
    responseLimit: '8mb',
  },
};
