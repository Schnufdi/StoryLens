const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Allow all origins (local use only)
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve the narrative app files statically
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint — browser posts here, server forwards to Anthropic
app.post('/api/claude', async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: { message: 'Missing or invalid API key. Add your Anthropic key in the app settings.' } });
  }

  try {
    // Use built-in fetch (Node 18+) or fall back
    const fetchFn = globalThis.fetch || require('node-fetch');

    const response = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: { message: 'Proxy error: ' + err.message } });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log('');
  console.log('  Narrative server running at:');
  console.log(`  → http://localhost:${PORT}`);
  console.log('');
  console.log('  Open that URL in Chrome to use the app.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
