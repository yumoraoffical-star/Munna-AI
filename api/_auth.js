// ==============================================================================
// MUNNA AI — SERVER-SIDE AUTHENTICATION, CORS & QUOTA MIDDLEWARE (EDGE RUNTIME)
// ==============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ipnbebwrefxlvoqneaga.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbmJlYndyZWZ4bHZvcW5lYWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNDQ5ODgsImV4cCI6MjA1NzYyMDk4OH0.xQxZ5j-nB2sXp2o0mS8R9q8tW3b5c7e1f4g6h8i0j2k';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://munnaai.youmika.site',
  'https://munna-ai.vercel.app'
];

// In-memory quota tracker for Edge execution instances
// Key: identifier (user_id or guest_ip_day), Value: count
const quotaStore = new Map();

function getClientIdentifier(req, user, isGuest) {
  if (user && user.id) {
    return `user:${user.id}`;
  }
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'guest';
  const ip = forwarded.split(',')[0].trim();
  const guestId = req.headers.get('x-guest-id') || 'anon';
  return `guest:${ip}:${guestId}`;
}

function checkAndIncrementQuota(identifier, plan, isGuest) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${identifier}:${today}`;
  const currentCount = quotaStore.get(key) || 0;

  let maxLimit = 10; // Free member default: 10/day
  if (isGuest) {
    maxLimit = 5; // Guest trial limit: 5/day
  } else if (plan === 'pro' || plan === 'king' || plan === 'vip') {
    maxLimit = 1000; // Pro/King limit: 1000/day
  }

  if (currentCount >= maxLimit) {
    return {
      allowed: false,
      current: currentCount,
      limit: maxLimit,
      plan: isGuest ? 'guest' : plan
    };
  }

  quotaStore.set(key, currentCount + 1);
  return {
    allowed: true,
    current: currentCount + 1,
    limit: maxLimit,
    remaining: maxLimit - (currentCount + 1),
    plan: isGuest ? 'guest' : plan
  };
}

export function getCorsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  let allowedOrigin = 'https://munnaai.youmika.site';

  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Access, X-Guest-Id',
    'Access-Control-Max-Age': '86400'
  };
}

export async function verifyAuthAndQuota(req, serviceName = 'chat') {
  const corsHeaders = getCorsHeaders(req);

  // 1. Check for Supabase JWT in Authorization header
  const authHeader = req.headers.get('authorization') || '';
  const isGuestHeader = req.headers.get('x-guest-access') === 'true';

  let user = null;
  let isGuest = false;
  let plan = 'free';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`
        }
      });

      if (userRes.ok) {
        user = await userRes.json();
        plan = user.app_metadata?.plan || user.user_metadata?.plan || 'free';
      }
    } catch (e) {
      console.warn('Supabase token verification error:', e.message);
    }
  }

  // 2. If no valid Supabase user, check if guest access is allowed
  if (!user) {
    if (isGuestHeader) {
      isGuest = true;
      plan = 'guest';
    } else {
      return {
        ok: false,
        response: new Response(JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in to access Munna AI services.'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      };
    }
  }

  // 3. Server-side Quota Enforcement
  const clientId = getClientIdentifier(req, user, isGuest);
  const quotaResult = checkAndIncrementQuota(clientId, plan, isGuest);

  if (!quotaResult.allowed) {
    const quotaMsg = isGuest
      ? 'Mehman trial quota (5 messages/day) pura ho gaya hai! Kripya free khata banayein ya login karein.'
      : 'Aaj ka daily message quota pura ho gaya hai! Bahubali Pro pass leke unlimited baat karein.';

    return {
      ok: false,
      response: new Response(JSON.stringify({
        error: 'QUOTA_EXCEEDED',
        message: quotaMsg,
        current: quotaResult.current,
        limit: quotaResult.limit,
        plan: quotaResult.plan
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    };
  }

  return {
    ok: true,
    user,
    isGuest,
    plan,
    corsHeaders,
    quota: quotaResult
  };
}
