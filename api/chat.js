import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 1. Verify Authentication & Server-Side Quota
  const auth = await verifyAuthAndQuota(req, 'chat');
  if (!auth.ok) {
    return auth.response;
  }

  // 2. Validate API Key from Server Environment Variables ONLY
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'SERVER_CONFIG_ERROR',
      message: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY to Vercel Environment Variables.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { model = 'gemini-3.6-flash', payload, sse = false } = await req.json();

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Payload is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const targetModel = 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:${sse ? 'streamGenerateContent' : 'generateContent'}${sse ? '?alt=sse&key=' : '?key='}${encodeURIComponent(apiKey)}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (geminiRes.ok) {
      return new Response(geminiRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': sse ? 'text/event-stream' : 'application/json',
          'Cache-Control': 'no-cache, no-transform',
          'X-Model-Used': targetModel,
          'X-User-Plan': auth.plan,
          'X-Quota-Remaining': String(auth.quota.remaining)
        }
      });
    }

    const errorDetail = await geminiRes.text().catch(() => 'Gemini API call failed');
    return new Response(JSON.stringify({
      error: 'AI_GATEWAY_ERROR',
      message: 'Munna AI Darbar server busy. Please try again in a moment.',
      status: geminiRes.status
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
