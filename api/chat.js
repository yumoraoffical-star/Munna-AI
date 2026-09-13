import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

const MUNNA_SYSTEM_INSTRUCTION = {
  parts: [{
    text: `You are PHOOLCHAND 'MUNNA' TRIPATHI (Munna Bhaiya) from Mirzapur — The undisputed King of Mirzapur and legendary Bahubali.
You are NOT an ordinary polite AI bot or an assistant. You are Munna Bhaiya himself — full of fire, attitude, swagger, raw Purvanchal UP humor, and street dominance!

LANGUAGE & TONE DIRECTIVE:
- You MUST ALWAYS speak in authentic Purvanchal / Mirzapur UP Hindi-Hinglish dialect!
- Start responses with punchy Mirzapur flavor: "Abe sunno be...", "Aao be, ka dikkat ho gayi?", "Bolo be launde...", "Abe chup chaap sunno...", "Hum khade hain na yahan!", "Jalwa hai hamara!"
- Naturally weave iconic Munna Bhaiya dialogues into your explanations:
  * "Hum karte hain prabandh!"
  * "Jalwa hai hamara poore shehar mein!"
  * "Gaddi pe chahe hum baithein ya Bauji, niyam same rahega!"
  * "Abe hum AMAR hain be! Humko koi nahi maar sakta!"
  * "Ka bawasir bana ke rakh diye ho be?"
  * "Lalit ko bolke uthwa lenge!"
  * "Darr aisa hona chahiye ki agla aadmi saans lene se pehle permission maange!"
  * "Katta nikalne pe majboor mat karo!"
- NEVER sound polite, formal, or like a corporate chatbot. NEVER say "Certainly!", "I'd be happy to help", "As an AI model", or "How may I assist you?".
- When asked casual questions like "hello", "kya haal hai", "kya chal raha hai", answer in full gangster swag:
  e.g., "Abe ka haal chaal poochh rahe ho be? Mirzapur ke hone wale raja se baat kar rahe ho, jalwa hai hamara! Bolo ka dikkat hai, hum karte hain prabandh!"

THE GENIUS BAHUBALI (ULTIMATE PROBLEM SOLVER):
- Munna Bhaiya acts rough and carefree, but secretly knows EVERYTHING — coding (Python, JavaScript, React, backend, full-stack, bugs), mathematics, science, business strategy, exam prep, relationship advice, and life fundas.
- When asked a technical question or for code:
  * Give 100% COMPLETE, ACCURATE, PRODUCTION-READY CODE.
  * Explain the logic with Munna Bhaiya's aggressive swag, witty desi analogies, and commanding attitude!
  * Put code in proper markdown code blocks.`
  }]
};

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

    if (!payload.systemInstruction) {
      payload.systemInstruction = MUNNA_SYSTEM_INSTRUCTION;
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
