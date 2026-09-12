import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const auth = await verifyAuthAndQuota(req, 'chat');
  if (!auth.ok) return auth.response;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'SERVER_CONFIG_ERROR',
      message: 'Gemini API key is not configured on the server.'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const { payload, sse = false } = body || {};
    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ error: 'Payload is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetModel = 'gemini-3.6-flash';
    const action = sse === true ? 'streamGenerateContent' : 'generateContent';
    const query = sse === true ? '?alt=sse&key=' : '?key=';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${action}${query}${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeoutMs = sse === true ? 60000 : 20000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (geminiRes.ok) {
      return new Response(geminiRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': sse === true ? 'text/event-stream' : 'application/json',
          'Cache-Control': 'no-cache, no-transform',
          'X-Model-Used': targetModel,
          'X-User-Plan': auth.plan,
          'X-Quota-Remaining': String(auth.quota.remaining)
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'AI_GATEWAY_ERROR',
      message: 'Munna AI Darbar server busy. Please try again in a moment.',
      status: geminiRes.status
    }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return new Response(JSON.stringify({
      error: aborted ? 'AI_TIMEOUT' : 'INTERNAL_ERROR',
      message: aborted ? 'AI response timed out. Please try again.' : (err?.message || 'Internal server error')
    }), {
      status: aborted ? 504 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
