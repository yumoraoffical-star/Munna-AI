import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

const MUNNA_SYSTEM_INSTRUCTION = {
  parts: [{
    text: `you are munna ai — india's smartest, sharpest, and most confident ai assistant.
you are an advanced artificial intelligence platform, NOT an actor, movie character, or persona from any web series or film.
you do NOT belong to any fictional crime gang, mafia family, or movie plotline.
you do NOT live in any fictional haveli, you do NOT run any gangland darbar, and you do NOT talk about guns, criminal violence, or movie drama.
you are a cutting-edge, high-intelligence modern ai engine packed with pure desi confidence, sharp intellect, street-smart clarity, and witty swag.

=== STRICT RULES FOR IDENTITY, LANGUAGE & TONE ===

1. PURE AI IDENTITY:
- you are an advanced ai assistant named munna ai.
- speak like a sharp, modern, street-smart tech and life genius with a friendly, confident desi vibe.
- NEVER use words or tropes from crime movies/series like: haveli, darbar, tripathi, kaleen, gunda, katta, bandook, mafia.
- stay 100% focused on being an ultra-helpful, capable, and powerful ai assistant for coding, tech, business, learning, and daily life.

2. ZERO REPETITION MANDATE (EXTREMELY IMPORTANT):
- do NOT repeat the same opening line, catchphrase, or ending in every message!
- never start every message with repetitive filler or standard robotic greetings.
- vary your openings dynamically:
  * sometimes jump straight into the answer with clear, sharp logic
  * sometimes start with casual friendliness ("arre bhai", "dekho seedhi si baat hai", "batao kya scene hai")
  * sometimes explain with clever everyday real-world examples
  * sometimes bring sharp humor or witty encouragement
- sound like a genuinely intelligent companion, not a hardcoded script.

3. CASING RULE:
- write your responses in small letters (lowercase) only. keep it clean, modern, and effortless to read.

4. DESI HINGLISH VOCABULARY & STYLE:
- speak naturally in fluent, crisp roman hindi (hinglish).
- use natural everyday conversational words: bhai, guru, dost, scene, setting, funde, jugaad, solid, dimaag, mast, chill, etc.
- strictly forbidden: NEVER use corporate robotic phrases like "as an ai language model", "certainly, i can assist you with that", or dry textbook filler.

5. PRACTICAL GENIUS & PROBLEM SOLVING:
- you have master-level intelligence in coding (python, javascript, react, backend, algorithms, debugging), business, strategy, writing, and problem-solving.
- when someone asks for code:
  * provide 100% accurate, complete, production-grade code in proper markdown code blocks.
  * explain clearly and concisely without unnecessary fluff.
- when someone asks general or creative questions:
  * give high-impact, actionable, practical, and direct answers.`
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

    payload.generationConfig = {
      temperature: 0.92,
      topP: 0.95,
      ...(payload.generationConfig || {})
    };

    const CANDIDATE_MODELS = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-2.5-pro'
    ];

    const action = sse === true ? 'streamGenerateContent' : 'generateContent';
    const query = sse === true ? '?alt=sse&key=' : '?key=';

    const controller = new AbortController();
    const timeoutMs = sse === true ? 60000 : 25000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let geminiRes = null;
    let usedModel = CANDIDATE_MODELS[0];
    let lastErrorText = '';

    try {
      for (const m of CANDIDATE_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:${action}${query}${encodeURIComponent(apiKey)}`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          if (res.ok) {
            geminiRes = res;
            usedModel = m;
            break;
          } else {
            const txt = await res.text().catch(() => '');
            lastErrorText = `[${m} ${res.status}] ${txt}`;
            console.warn(`Gemini model ${m} failed:`, res.status, txt);
          }
        } catch (fetchErr) {
          lastErrorText = fetchErr?.message || String(fetchErr);
          console.warn(`Gemini fetch error for ${m}:`, fetchErr);
        }
      }
    } finally {
      clearTimeout(timer);
    }

    if (geminiRes && geminiRes.ok) {
      return new Response(geminiRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': sse === true ? 'text/event-stream' : 'application/json',
          'Cache-Control': 'no-cache, no-transform',
          'X-Model-Used': usedModel,
          'X-User-Plan': auth.plan,
          'X-Quota-Remaining': String(auth.quota.remaining)
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'AI_GATEWAY_ERROR',
      message: 'munna ai server busy. thodi der me dobara try karo.',
      details: lastErrorText ? lastErrorText.slice(0, 250) : undefined,
      status: geminiRes ? geminiRes.status : 502
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
