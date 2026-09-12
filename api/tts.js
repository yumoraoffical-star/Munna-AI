import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = {
  runtime: 'edge'
};

const DEFAULT_CARTESIA_VOICE = 'bdab08ad-4137-4548-b9db-6142854c7525';
const DEFAULT_ELEVEN_VOICE = 'pNInz6obpgDQGcFmaJgB';

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
  const auth = await verifyAuthAndQuota(req, 'tts');
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { text, voiceId } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;

    // Read keys strictly from server environment variables
    const cartesiaKey = process.env.CARTESIA_API_KEY || null;
    const elevenApiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || null;

    // 1. CARTESIA SONIC 3.6 REAL-TIME TTS (Primary Engine)
    if (cartesiaKey) {
      const isUUID = voiceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voiceId);
      const cartesiaVoiceId = isUUID ? voiceId : (process.env.CARTESIA_VOICE_ID || DEFAULT_CARTESIA_VOICE);

      try {
        const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
          method: 'POST',
          headers: {
            'X-API-Key': cartesiaKey,
            'Authorization': `Bearer ${cartesiaKey}`,
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model_id: 'sonic-3.6',
            transcript: snippet,
            voice: {
              mode: 'id',
              id: cartesiaVoiceId
            },
            output_format: {
              container: 'mp3',
              encoding: 'mp3',
              sample_rate: 44100
            },
            language: 'hi'
          })
        });

        if (cartesiaRes.ok) {
          return new Response(cartesiaRes.body, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
              'X-TTS-Engine': 'Cartesia-Sonic-3.6',
              'X-Quota-Remaining': String(auth.quota.remaining)
            }
          });
        }
      } catch (cartesiaErr) {
        console.warn('Cartesia TTS request failed, trying ElevenLabs fallback:', cartesiaErr?.message || cartesiaErr);
      }
    }

    // 2. ELEVENLABS FALLBACK ENGINE
    if (elevenApiKey) {
      const elevenVoiceId = (voiceId && !voiceId.includes('-')) ? voiceId : DEFAULT_ELEVEN_VOICE;

      try {
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: snippet,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (elevenRes.ok) {
          return new Response(elevenRes.body, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
              'X-TTS-Engine': 'ElevenLabs',
              'X-Quota-Remaining': String(auth.quota.remaining)
            }
          });
        }
      } catch (elevenErr) {
        console.warn('ElevenLabs TTS failed:', elevenErr?.message || elevenErr);
      }
    }

    // If neither key is present or both failed
    return new Response(JSON.stringify({
      error: 'TTS_UNAVAILABLE',
      message: 'Voice synthesis service is currently offline. Please configure CARTESIA_API_KEY or ELEVENLABS_API_KEY.'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('TTS Handler Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
