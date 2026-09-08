export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { model = 'gemini-3.6-flash', payload, sse = true } = await req.json();

    const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY)
      ? process.env.GEMINI_API_KEY
      : atob('QVEuQWI4Uk42SksySU9iTXUwUUlpdVFqaU5QSjdYcElJTkRhZ25WTmxiUFljdE5vc1BndVE=');

    const sseParam = sse ? '?alt=sse&key=' : '?key=';
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${sse ? 'streamGenerateContent' : 'generateContent'}${sseParam}${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      return new Response(errorText, {
        status: geminiRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(geminiRes.body, {
      status: 200,
      headers: {
        'Content-Type': sse ? 'text/event-stream' : 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
