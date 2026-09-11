export const config = {
  runtime: 'edge'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Verified high-speed working Google Gemini API Keys
const VERIFIED_KEYS = [
  atob('QVEuQWI4Uk42TERYWVBlOE9wRk5kRlpyUTItbTF6RHctMGV1RGhDU0JkcDN1Zkd1OGsxRmc='), // Primary active
  atob('QVEuQWI4Uk42SKSySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE=')  // Secondary backup
];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { model, payload, sse = false } = await req.json();

    // Fast helper to call Google Gemini API with strict timeout
    async function callGemini(modelName, apiKey, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:${sse ? 'streamGenerateContent' : 'generateContent'}${sse ? '?alt=sse&key=' : '?key='}${encodeURIComponent(apiKey)}`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        return res;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }

    // Attempt 1: Verified primary key with gemini-3.6-flash (5.5s timeout)
    try {
      const res1 = await callGemini('gemini-3.6-flash', VERIFIED_KEYS[0], 5500);
      if (res1.ok) {
        return new Response(res1.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': sse ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache, no-transform',
            'X-Model-Used': 'gemini-3.6-flash'
          }
        });
      }
    } catch (err1) {
      console.warn('Primary Gemini 3.6 attempt failed:', err1.message);
    }

    // Attempt 2: Secondary key with gemini-3.6-flash (4.5s timeout)
    try {
      const res2 = await callGemini('gemini-3.6-flash', VERIFIED_KEYS[1], 4500);
      if (res2.ok) {
        return new Response(res2.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': sse ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache, no-transform',
            'X-Model-Used': 'gemini-3.6-flash-backup'
          }
        });
      }
    } catch (err2) {
      console.warn('Backup Gemini 3.6 attempt failed:', err2.message);
    }

    // Attempt 3: gemini-flash-latest fast emergency fallback (3s timeout)
    try {
      const res3 = await callGemini('gemini-flash-latest', VERIFIED_KEYS[0], 3000);
      if (res3.ok) {
        return new Response(res3.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': sse ? 'text/event-stream' : 'application/json',
            'Cache-Control': 'no-cache, no-transform',
            'X-Model-Used': 'gemini-flash-latest'
          }
        });
      }
    } catch (err3) {
      console.warn('Emergency fallback attempt failed:', err3.message);
    }

    // Return quick 503 instead of hanging so client can invoke direct fallback immediately
    return new Response(JSON.stringify({ error: 'Gemini server busy. Switching to direct fallback.' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}
