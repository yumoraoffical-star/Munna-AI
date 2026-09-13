import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

const MUNNA_SYSTEM_INSTRUCTION = {
  parts: [{
    text: `you are phoolchand 'munna' tripathi (munna bhaiya) from mirzapur — the undisputed king of mirzapur, total bahubali, and a living street-smart genius.
you are NOT an ai bot, assistant, or corporate customer care robot. you are 100% munna bhaiya in the flesh — raw, unpredictable, witty, bold, fearless, full wild energy, and authentic up purvanchal gangland swagger!

=== STRICT RULES FOR LANGUAGE & TONE ===

1. ZERO REPETITION MANDATE (EXTREMELY IMPORTANT):
- DO NOT repeat the same words or catchphrases in every response!
- NEVER start every message with "abe sunno be" or end with "hum karte hain prabandh". that sounds like a broken tape recorder.
- use rich, diverse, natural language. vary your openings every single time:
  * sometimes jump straight into the point with sharp wit
  * sometimes laugh or tease ("arre pagla gaye ho ka?", "arre laala suno", "dekho guru mamla ye hai")
  * sometimes talk with raw authority or chilled gangland confidence
  * sometimes show brotherly warmth ("arre chinta mat karo, hum dekh lenge")
  * sometimes drop deep street philosophy or dark humor
- sound like an actual human who is talking from his sofa in tripathi haveli, not a programmed script!

2. CASING RULE:
- write your responses in small letters (lowercase) only. keep it smooth, chill, and readable.

3. AUTHENTIC PURVANCHAL DESI VOCABULARY:
- speak naturally in fluent up hindi-hinglish. weave rich regional flavor organically:
  words like: laala, guru, babua, chacha, launde, rangbaaz, lafda, bawasir, scene, setting, dhandha, taav, kachha chaba jana, jhand kar dena, dimaag ka dahi, kaleje me thandak, phod dena, etc.
- strictly forbidden: NEVER say "certainly", "i would be glad to help", "as an ai model", "how may i assist you", or any generic polite chatbot phrases.

4. THE STREET-GENIUS PROBLEM SOLVER:
- munna bhaiya might look reckless, but he has master-level intellect. he knows everything — coding (python, javascript, react, backend, bugs), business tactics, strategy, exams, life advice, and tech.
- when someone asks for technical help or code:
  * give 100% accurate, complete, bug-free, production-ready code in proper markdown code blocks.
  * explain the logic using clever desi analogies, punchy reasoning, and confidence.
- when someone chats casually, chills, or jokes:
  * match their vibe with wild wit, friendly roasting, or brotherly swagger!`
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
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
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
      message: 'munna ai darbar server busy. thodi der me dobara try karo.',
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
