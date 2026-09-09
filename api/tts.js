export const config = {
  runtime: 'edge'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

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
    const { text, voiceId = 'pNInz6obpgDQGcFmaJgB' } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = (typeof process !== 'undefined' && process.env?.ELEVEN_API_KEY)
      ? process.env.ELEVEN_API_KEY
      : atob('c2tfODBjZmMxZDhmMGYyNWI4ZTNlNDdhMzljYTNmNzM0NDYzZWYyNDAyMGM2ZWYzNzUw');

    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
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
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
}
