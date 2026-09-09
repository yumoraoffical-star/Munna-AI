export const config = {
  runtime: 'edge'
};

const BACKUP_KEYS = [
  atob('QVEuQWI4Uk42SksySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE='),
  atob('QVEuQWI4Uk42SUVteDh1MVI0SFZKYTcyWDJYaUhtZkZRV09pelJtVVJwRG8tRF9tZHZtTmc=')
];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { model = 'gemini-3.6-flash', payload, sse = true } = await req.json();

    const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : null;
    const candidateKeys = envKey ? [envKey, ...BACKUP_KEYS] : BACKUP_KEYS;

    const sseParam = sse ? '?alt=sse&key=' : '?key=';
    let lastError = null;

    // Try keys sequentially for maximum reliability and speed
    for (const apiKey of candidateKeys) {
      if (!apiKey) continue;
      try {
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${sse ? 'streamGenerateContent' : 'generateContent'}${sseParam}${encodeURIComponent(apiKey)}`;

        const geminiRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (geminiRes.ok) {
          return new Response(geminiRes.body, {
            status: 200,
            headers: {
              'Content-Type': sse ? 'text/event-stream' : 'application/json',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no'
            }
          });
        }

        const errText = await geminiRes.text();
        lastError = { status: geminiRes.status, text: errText };

        // If rate limit (429) or service unavailable (503), try next key immediately
        if (geminiRes.status === 429 || geminiRes.status === 503) {
          continue;
        } else {
          // If bad request or other error, return immediately
          return new Response(errText, {
            status: geminiRes.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (fetchErr) {
        lastError = { status: 502, text: JSON.stringify({ error: fetchErr.message }) };
      }
    }

    return new Response(lastError?.text || JSON.stringify({ error: 'All AI model keys unavailable' }), {
      status: lastError?.status || 502,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
