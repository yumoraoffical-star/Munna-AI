export const config = {
  runtime: 'edge'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// Default high-fidelity Hindi/Hinglish male voice for Cartesia Sonic
const DEFAULT_CARTESIA_VOICE = 'bdab08ad-4137-4548-b9db-6142854c7525';
const DEFAULT_ELEVEN_VOICE = 'pNInz6obpgDQGcFmaJgB';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { text, voiceId } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;

    // --- 1. CARTESIA SONIC 3.6 REAL-TIME TTS (Primary Engine) ---
    const cartesiaKey = (typeof process !== 'undefined' && process.env?.CARTESIA_API_KEY)
      ? process.env.CARTESIA_API_KEY
      : atob('c2tfY2FyX05aemVDM3lkM0pidlNyVnNmZW9ocDM=');

    if (cartesiaKey) {
      const isUUID = voiceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voiceId);
      const cartesiaVoiceId = isUUID
        ? voiceId
        : ((typeof process !== 'undefined' && process.env?.CARTESIA_VOICE_ID) || DEFAULT_CARTESIA_VOICE);

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
              ...CORS_HEADERS,
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
              'X-TTS-Engine': 'Cartesia-Sonic-3.6'
            }
          });
        }

        const errDetail = await cartesiaRes.text();
        console.warn('Cartesia TTS returned status', cartesiaRes.status, errDetail);
      } catch (cartesiaErr) {
        console.warn('Cartesia TTS request failed, attempting ElevenLabs fallback:', cartesiaErr);
      }
    }

    // --- 2. ELEVENLABS FALLBACK ENGINE ---
    const elevenApiKey = (typeof process !== 'undefined' && process.env?.ELEVEN_API_KEY)
      ? process.env.ELEVEN_API_KEY
      : atob('c2tfODBjZmMxZDhmMGYyNWI4ZTNlNDdhMzljYTNmNzM0NDYzZWYyNDAyMGM2ZWYzNzUw');

    const elevenVoiceId = (voiceId && !voiceId.includes('-')) ? voiceId : DEFAULT_ELEVEN_VOICE;

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

    if (!elevenRes.ok) {
      const errTxt = await elevenRes.text();
      return new Response(errTxt, {
        status: elevenRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(elevenRes.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-TTS-Engine': 'ElevenLabs'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}

