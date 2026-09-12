import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = { runtime: 'edge' };

const STYLE_ENHANCERS = {
  mirzapur: ', royal mirzapur mafia haveli aesthetic, rich gold and crimson cinematic lighting, 8k resolution, photorealistic masterpiece',
  gangster: ', badass desi gangster swag, dark gritty purvanchal mafia atmosphere, dramatic rim lighting, highly detailed 8k',
  cyberpunk: ', futuristic desi cyberpunk mirzapur, glowing neon signs in hindi, atmospheric haze, ultra detailed 8k render',
  avatar: ', powerful royal bahubali lion with golden crown and gold chains, majestic posture, hyperrealistic 8k',
  realistic: ', professional ultra-realistic 35mm photograph, natural lighting, sharp focus, 8k uhd'
};

function clampDimension(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(2048, Math.max(256, Math.round(n / 64) * 64));
}

export default async function handler(req) {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const auth = await verifyAuthAndQuota(req, 'image');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { prompt, style = 'mirzapur' } = body || {};
    const width = clampDimension(body?.width, 1024);
    const height = clampDimension(body?.height, 1024);

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanPrompt = prompt.trim().slice(0, 2000);
    const enhancer = STYLE_ENHANCERS[style] || STYLE_ENHANCERS.mirzapur;
    const enhancedPrompt = `${cleanPrompt}${enhancer}`;
    const pixazoKey = process.env.PIXAZO_API_KEY || null;

    let imageUrl = null;
    let engineUsed = 'flux-hd';

    if (pixazoKey) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let pixazoRes;
        try {
          pixazoRes = await fetch('https://gateway.pixazo.ai/gpt-image-2/v1/text-to-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Ocp-Apim-Subscription-Key': pixazoKey
            },
            body: JSON.stringify({ prompt: enhancedPrompt, size: `${width}x${height}` }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timer);
        }

        if (pixazoRes.ok) {
          const data = await pixazoRes.json();
          imageUrl = data.image_url || data.url || data.images?.[0] || null;
          if (imageUrl) engineUsed = 'pixazo';
        }
      } catch (err) {
        console.warn('Pixazo failed; using FLUX fallback:', err?.message || err);
      }
    }

    if (!imageUrl) {
      const seed = Math.floor(Math.random() * 9999999);
      imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
    }

    return new Response(JSON.stringify({
      success: true, imageUrl, originalPrompt: cleanPrompt, enhancedPrompt,
      style, width, height, engine: engineUsed, plan: auth.plan,
      quotaRemaining: auth.quota.remaining
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: err?.message || 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
