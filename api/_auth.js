// ==============================================================================
// MUNNA AI — SERVER-SIDE AUTHENTICATION, CORS & QUOTA MIDDLEWARE (EDGE RUNTIME)
// ==============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Keep this allow-list explicit. Do not reflect arbitrary *.vercel.app origins
// because that would let another Vercel deployment call the API with credentials.
const ALLOWED_ORIGINS = new Set([
  'https://munnaai.youmika.site',
  'https://munna-ai.vercel.app'
]);

// In-memory quota tracker for Edge execution instances.
// NOTE: this is best-effort only because Edge instances are ephemeral. For
// production-grade global quotas, replace this with a durable store (e.g. DB/KV).
const quotaStore = new Map();

function getClientIdentifier(req, user, isGuest) {
  if (user && user.id) {
    return `user:${user.id}`;
  }

  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const ip = forwarded.split(',')[0].trim() || 'unknown-ip';
  const guestId = req.headers.get('x-guest-id') || 'anon';
  return `guest:${ip}:${guestId}`;
}

function checkAndIncrementQuota(identifier, plan, isGuest) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${identifier}:${today}`;
  const currentCount = quotaStore.get(key) || 0;

  let maxLimit = 10;
  if (isGuest) {
    maxLimit = 5;
  } else if (plan === 'pro' || plan === 'king' || plan === 'vip') {
    maxLimit = 1000;
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
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Guest-Access, X-Guest-Id',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export async function verifyAuthAndQuota(req, serviceName = 'chat') {
  const corsHeaders = getCorsHeaders(req);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      response: new Response(JSON.stringify({
        error: 'SERVER_CONFIG_ERROR',
        message: 'Supabase server configuration is missing.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    };
  }

  const authHeader = req.headers.get('authorization') || '';
  const isGuestHeader = req.headers.get('x-guest-access') === 'true';

  let user = null;
  let isGuest = false;
  let plan = 'free';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`
          }
        });

        if (userRes.ok) {
          user = await userRes.json();
          plan = user.app_metadata?.plan || user.user_metadata?.plan || 'free';
        }
      } catch (e) {
        console.warn('Supabase token verification error:', e?.message || e);
      }
    }
  }

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
    serviceName,
    corsHeaders,
    quota: quotaResult
  };
}
