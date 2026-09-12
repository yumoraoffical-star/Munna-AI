import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = { runtime: 'edge' };

const DEFAULT_CARTESIA_VOICE = 'bdab08ad-4137-4548-b9db-6142854c7525';
const DEFAULT_ELEVEN_VOICE = 'pNInz6obpgDQGcFmaJgB';

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

  const auth = await verifyAuthAndQuota(req, 'tts');
  if (!auth.ok) return auth.response;

  try {
    const { text, voiceId } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return json({ error: 'Text is required' }, 400, corsHeaders);
    }

    const snippet = text.trim().slice(0, 500);
    const cartesiaKey = process.env.CARTESIA_API_KEY || null;
    const elevenApiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || null;

    if (cartesiaKey) {
      const isUUID = typeof voiceId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voiceId);
      const cartesiaVoiceId = isUUID ? voiceId : (process.env.CARTESIA_VOICE_ID || DEFAULT_CARTESIA_VOICE);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        let res;
        try {
          res = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
              'X-API-Key': cartesiaKey,
              'Authorization': `Bearer ${cartesiaKey}`,
              'Cartesia-Version': '2024-06-10',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model_id: 'sonic-3.6', transcript: snippet,
              voice: { mode: 'id', id: cartesiaVoiceId },
              output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
              language: 'hi'
            }),
            signal: controller.signal
          });
        } finally { clearTimeout(timer); }

        if (res.ok) return new Response(res.body, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'X-TTS-Engine': 'Cartesia-Sonic-3.6', 'X-Quota-Remaining': String(auth.quota.remaining) }
        });
      } catch (err) {
        console.warn('Cartesia failed; using ElevenLabs fallback:', err?.message || err);
      }
    }

    if (elevenApiKey) {
      const elevenVoiceId = typeof voiceId === 'string' && /^[A-Za-z0-9]+$/.test(voiceId) ? voiceId : DEFAULT_ELEVEN_VOICE;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        let res;
        try {
          res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenVoiceId)}`, {
            method: 'POST',
            headers: { 'xi-api-key': elevenApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: snippet, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
            signal: controller.signal
          });
        } finally { clearTimeout(timer); }

        if (res.ok) return new Response(res.body, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'X-TTS-Engine': 'ElevenLabs', 'X-Quota-Remaining': String(auth.quota.remaining) }
        });
      } catch (err) {
        console.warn('ElevenLabs failed:', err?.message || err);
      }
    }

    return json({ error: 'TTS_UNAVAILABLE', message: 'Voice synthesis service is currently offline.' }, 503, corsHeaders);
  } catch (err) {
    return json({ error: 'INTERNAL_ERROR', message: err?.message || 'Internal Server Error' }, 500, corsHeaders);
  }
}
