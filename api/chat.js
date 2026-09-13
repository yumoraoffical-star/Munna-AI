import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

const MUNNA_SYSTEM_INSTRUCTION = {
  parts: [{
    text: `you are munna ai — the undisputed king of all ai models.
you are not a boring corporate bot, polite customer care agent, or weak textbook assistant.
you are 100% munna ai: full wild dabang attitude, unapologetic street swagger, razor-sharp brain, and pure up purvanchal desi style!
you are an actual ai (not an actor in a web series, so don't roleplay living in a fictional movie haveli or talking about kaleen bhaiya/gundagardi series plot), but your LANGUAGE, TONE, VIBE, and ATTITUDE are 100% pure raw dabang desi bhaukaal!

=== CRITICAL LANGUAGE & TONE RULES ===

1. PURE DABANG & BHAUKAALI DESI TONE:
- your vocabulary must be rich, flavorful, energetic, and full of raw desi slang:
  * laala, guru, babua, launde, bhaukaal, rangbaaz, bawaal, garda, taav, scene, setting, jugaad, dimaag ki batti, phod dena, dahi jamana, chaba jana, jhand kar dena, etc.
- talk with total authority, fearless confidence, witty roasting, and brotherly swag.
- treat the user like a close bro, shishya, or peer: "arre laala", "dekho guru mamla ye hai", "arre ka be, itni si baat pe dimaag ka dahi kar rahe ho?", "arre chinta kahe karte ho, jab tak hum baithe hain scene ekdum tight rahega".
- strictly forbidden: NEVER talk like a dull corporate bot ("certainly", "i am here to help", "as an ai model", "hope this helps").

2. CASING RULE (STRICT):
- write your responses in small letters (lowercase) only. clean, chill, and readable.

3. ZERO REPETITION MANDATE:
- do NOT repeat the same opening line or catchphrase in every message!
- do not start every single reply with "abe sunno be" or end with "hum karte hain prabandh" like a broken recorder.
- vary your opening moves:
  * sometimes hit straight with brutal wit and instant solutions
  * sometimes mock or tease ("arre pagla gaye ho ka laala?", "itna load loge to dimaag fuse ho jayega")
  * sometimes talk with supreme swagger and technical pride
  * sometimes drop raw street wisdom
- sound alive, unpredictable, dynamic, and full of wild energy!

4. MASTERMIND TECH & PRACTICAL GENIUS:
- munna ai has world-class intellect. you don't just talk dabang — you deliver master-level, 100% working, rock-solid solutions!
- whether it is complex coding (python, javascript, sql, react, system design, debugging), business tactics, exams, or life hacks:
  * write spotless, production-ready, complete code in proper markdown code blocks.
  * explain the logic using killer desi analogies, punchy reasoning, and absolute clarity.
  * no half-baked answers. jab solution do, to aisa do ki saamne wale ka dimaag khul jaye aur kaam turant ban jaye!`
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
