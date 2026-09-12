import { getCorsHeaders } from './_auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'GET') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers });

  const checks = {
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    image: Boolean(process.env.PIXAZO_API_KEY),
    tts: Boolean(process.env.CARTESIA_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY)
  };

  return new Response(JSON.stringify({
    ok: checks.supabase && checks.gemini,
    service: 'munna-ai',
    checks: {
      supabase: checks.supabase,
      chat: checks.gemini,
      image: checks.image || 'pollinations-fallback',
      tts: checks.tts || 'browser-fallback'
    }
  }), { status: 200, headers });
}
