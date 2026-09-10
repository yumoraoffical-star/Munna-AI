export const config = {
  runtime: 'edge'
};

const BACKUP_KEYS = [
  atob('QVEuQWI4Uk42S2dIQ05idkw3ekJ6N1VXOXh3WlNpa0dNWFdBSkFoOGR0OGx3QndoYW5TbkE='),
  atob('QVEuQWI4Uk42SUVteDh1MVI0SFZKYTcyWDJYaUhtZkZRV09pelJtVVJwRG8tRF9tZHZtTmc='),
  atob('QVEuQWI4Uk42SKSySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE='),
  atob('QVEuQWI4Uk42TERYWVBlOE9wRk5kRlpyUTItbTF6RHctMGV1RGhDU0JkcDN1Zkd1OGsxRmc=')
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
    const { model = 'gemini-3.6-flash', payload, sse = true } = await req.json();

    const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : null;
    const candidateKeys = envKey ? [envKey, ...BACKUP_KEYS] : BACKUP_KEYS;

    // Map deprecated/failing models to active high-speed Gemini 3.6/3.7 models
    const requestedModel = (!model || model.includes('3.5')) ? 'gemini-3.6-flash' : model;

    // Fast fallback model list
    const candidateModels = Array.from(new Set([
      requestedModel,
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-flash-latest'
    ]));

    const sseParam = sse ? '?alt=sse&key=' : '?key=';
    let lastError = null;

    // Try keys and models sequentially with 9s timeout for sub-second failover
    for (const apiKey of candidateKeys) {
      if (!apiKey) continue;

      for (const targetModel of candidateModels) {
        try {
          const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${sse ? 'streamGenerateContent' : 'generateContent'}${sseParam}${encodeURIComponent(apiKey)}`;

          const geminiRes = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(9000)
          });

          if (geminiRes.ok) {
            return new Response(geminiRes.body, {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                'Content-Type': sse ? 'text/event-stream' : 'application/json',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
              }
            });
          }

          const errText = await geminiRes.text();
          lastError = { status: geminiRes.status, text: errText };

          // If 404, 503, 504 or 429, continue to next model/key
          if (geminiRes.status === 404 || geminiRes.status === 503 || geminiRes.status === 504 || geminiRes.status === 429) {
            continue;
          } else {
            break;
          }
        } catch (fetchErr) {
          lastError = { status: 502, text: JSON.stringify({ error: fetchErr.message }) };
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
