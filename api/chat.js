export const config = {
  runtime: 'edge'
};

// Priority order: Working active keys FIRST
const BACKUP_KEYS = [
  // Primary Active Key (Verified 200 OK sub-second response)
  atob('QVEuQWI4Uk42TERYWVBlOE9wRk5kRlpyUTItbTF6RHctMGV1RGhDU0JkcDN1Zkd1OGsxRmc='),
  // Secondary Active Keys
  atob('QVEuQWI4Uk42SksySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE='),
  atob('QVEuQWI4Uk42S2dIQ05idkw3ekJ6N1VXOXh3WlNpa0dNWFdBSkFoOGR0OGx3QndoYW5TbkE='),
  atob('QVEuQWI4Uk42SUVteDh1MVI0SFZKYTcyWDJYaUhtZkZRV09pelJtVVJwRG8tRF9tZHZtTmc=')
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export default async function handler(req) {
  // Handle CORS preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { model = 'gemini-3.6-flash', payload, sse = false } = await req.json();

    const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : null;
    const candidateKeys = Array.from(new Set((envKey ? [envKey, ...BACKUP_KEYS] : BACKUP_KEYS).filter(Boolean)));

    // Fast candidate models (Primary: gemini-3.6-flash, Fallback: gemini-flash-latest)
    const targetModel = (!model || model.includes('3.5')) ? 'gemini-3.6-flash' : model;
    const candidateModels = Array.from(new Set([
      targetModel,
      'gemini-3.6-flash',
      'gemini-flash-latest'
    ]));

    const sseParam = sse ? '?alt=sse&key=' : '?key=';
    let lastError = null;

    // Fast 4.5s timeout per attempt ensures failover happens well before Vercel gateway limit
    for (const apiKey of candidateKeys) {
      if (!apiKey) continue;

      for (const currentModel of candidateModels) {
        try {
          const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:${sse ? 'streamGenerateContent' : 'generateContent'}${sseParam}${encodeURIComponent(apiKey)}`;

          const geminiRes = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(4500)
          });

          if (geminiRes.ok) {
            return new Response(geminiRes.body, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                'Content-Type': sse ? 'text/event-stream' : 'application/json',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'X-Model-Used': currentModel
              }
            });
          }

          const errText = await geminiRes.text();
          lastError = { status: geminiRes.status, text: errText };

          // If rate-limited or unavailable, continue to next key immediately
          if (geminiRes.status === 404 || geminiRes.status === 429 || geminiRes.status >= 500) {
            continue;
          } else {
            break;
          }
        } catch (fetchErr) {
          lastError = { status: 504, text: JSON.stringify({ error: fetchErr.message || 'Request timeout' }) };
        }
      }
    }

    return new Response(lastError?.text || JSON.stringify({ error: 'All AI model keys unavailable' }), {
      status: lastError?.status || 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

