export const config = {
  runtime: 'edge'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Verified active Google Gemini API Keys
const PRIMARY_KEY = atob('QVEuQWI4Uk42TERYWVBlOE9wRk5kRlpyUTItbTF6RHctMGV1RGhDU0JkcDN1Zkd1OGsxRmc=');
const BACKUP_KEY = atob('QVEuQWI4Uk42SKSySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE=');

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

    const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : null;
    const activeKey = envKey || PRIMARY_KEY;

    async function callGemini(modelName, apiKey, timeoutMs = 8000) {
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

    // 1. Primary Attempt (gemini-3.6-flash, 8s timeout)
    let lastErrorDetail = null;
    try {
      const res1 = await callGemini('gemini-3.6-flash', activeKey, 8000);
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
      lastErrorDetail = await res1.text().catch(() => 'Primary non-ok response');
    } catch (err1) {
      lastErrorDetail = err1.message;
    }

    // 2. Backup Attempt (gemini-3.6-flash with backup key, 5s timeout)
    try {
      const res2 = await callGemini('gemini-3.6-flash', BACKUP_KEY, 5000);
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
      lastErrorDetail = await res2.text().catch(() => 'Backup non-ok response');
    } catch (err2) {
      lastErrorDetail = err2.message;
    }

    return new Response(JSON.stringify({
      error: 'Gemini server busy. Switching to direct fallback.',
      detail: lastErrorDetail
    }), {
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
