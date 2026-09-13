// Munna AI — Razorpay billing API
// Required env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY
import crypto from 'node:crypto';
import { getCorsHeaders } from './_auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const PLANS = {
  pro: { name: 'Munna Pro', amount: 29900, days: 30 },
  business: { name: 'Munna Business', amount: 79900, days: 30 }
};

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
}

async function getUser(req) {
  if (!SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: auth } });
  return r.ok ? r.json() : null;
}

async function adminUpdateUser(userId, appMetadata) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT', headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_metadata: appMetadata })
  });
  if (!r.ok) throw new Error('Could not update subscription');
  return r.json();
}

async function razorpayOrder(plan) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: plan.amount, currency: 'INR', receipt: `munna_${Date.now()}`, notes: { product: 'Munna AI', plan: plan.name } })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.description || 'Razorpay order creation failed');
  return data;
}

function validSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const actual = String(signature || '');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json(req, {}, 204);
  if (req.method !== 'GET' && req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405);

  const user = await getUser(req).catch(() => null);
  if (!user) return json(req, { error: 'UNAUTHORIZED', message: 'Please sign in before upgrading.' }, 401);

  if (req.method === 'GET') {
    const meta = user.app_metadata || {};
    const expires = meta.plan_expires_at || null;
    const active = meta.plan && meta.plan !== 'free' && (!expires || new Date(expires) > new Date());
    return json(req, { plan: active ? meta.plan : 'free', expires_at: active ? expires : null, configured: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && SERVICE_ROLE_KEY) });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !SERVICE_ROLE_KEY) return json(req, { error: 'BILLING_NOT_CONFIGURED', message: 'Razorpay billing is not configured on the server yet.' }, 503);

  const body = await req.json().catch(() => ({}));
  if (body?.action === 'create-order') {
    const plan = PLANS[body?.plan];
    if (!plan) return json(req, { error: 'INVALID_PLAN' }, 400);
    const order = await razorpayOrder(plan);
    return json(req, { key_id: RAZORPAY_KEY_ID, order_id: order.id, amount: order.amount, currency: order.currency, plan: body.plan, name: plan.name });
  }

  if (body?.action === 'verify') {
    const { order_id, payment_id, signature, plan: planKey } = body;
    if (!order_id || !payment_id || !signature || !PLANS[planKey]) return json(req, { error: 'INVALID_PAYMENT_DATA' }, 400);
    if (!validSignature(order_id, payment_id, signature)) return json(req, { error: 'INVALID_SIGNATURE' }, 400);
    const plan = PLANS[planKey];
    const current = user.app_metadata || {};
    const currentExpiry = current.plan_expires_at && new Date(current.plan_expires_at) > new Date() ? new Date(current.plan_expires_at) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + plan.days);
    const updated = await adminUpdateUser(user.id, { ...current, plan: planKey, plan_expires_at: currentExpiry.toISOString(), last_payment_id: payment_id, last_order_id: order_id });
    return json(req, { ok: true, plan: planKey, expires_at: currentExpiry.toISOString(), user: updated.user });
  }

  return json(req, { error: 'UNKNOWN_ACTION' }, 400);
}
