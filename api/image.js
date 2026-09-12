import { verifyAuthAndQuota, getCorsHeaders } from './_auth.js';

export const config = {
  runtime: 'edge'
};

const STYLE_ENHANCERS = {
  mirzapur: ', royal mirzapur mafia haveli aesthetic, rich gold and crimson cinematic lighting, 8k resolution, photorealistic masterpiece',
  gangster: ', badass desi gangster swag, dark gritty purvanchal mafia atmosphere, dramatic rim lighting, highly detailed 8k',
  cyberpunk: ', futuristic desi cyberpunk mirzapur, glowing neon signs in hindi, atmospheric haze, ultra detailed 8k render',
  avatar: ', powerful royal bahubali lion with golden crown and gold chains, majestic posture, hyperrealistic 8k',
  realistic: ', professional ultra-realistic 35mm photograph, natural lighting, sharp focus, 8k uhd'
};

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
  const auth = await verifyAuthAndQuota(req, 'image');
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { prompt, style = 'mirzapur', width = 1024, height = 1024 } = await req.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanPrompt = prompt.trim();
    const enhancer = STYLE_ENHANCERS[style] || STYLE_ENHANCERS.mirzapur;
    const enhancedPrompt = `${cleanPrompt}${enhancer}`;

    // Read key exclusively from server environment variable
    const pixazoKey = process.env.PIXAZO_API_KEY || null;

    let imageUrl = null;
    let engineUsed = 'flux-hd';

    // 1. Try Pixazo API Gateway if configured
    if (pixazoKey) {
      try {
        const pixazoController = new AbortController();
        const pixazoTimeout = setTimeout(() => pixazoController.abort(), 8000);

        const pixazoRes = await fetch('https://gateway.pixazo.ai/gpt-image-2/v1/text-to-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': pixazoKey
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            size: `${width}x${height}`
          }),
          signal: pixazoController.signal
        });
        clearTimeout(pixazoTimeout);

        if (pixazoRes.ok) {
          const pixazoData = await pixazoRes.json();
          imageUrl = pixazoData.image_url || pixazoData.url || (pixazoData.images && pixazoData.images[0]);
          if (imageUrl) engineUsed = 'pixazo';
        }
      } catch (pixErr) {
        console.warn('Pixazo Gateway fallback to FLUX.1:', pixErr?.message || pixErr);
      }
    }

    // 2. High-Definition FLUX.1 Engine Fallback (Clean, Keyless, 100% Reliable)
    if (!imageUrl) {
      const seed = Math.floor(Math.random() * 9999999);
      const encodedPrompt = encodeURIComponent(enhancedPrompt);
      imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&model=flux&seed=${seed}`;
      engineUsed = 'flux-hd';
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl: imageUrl,
      originalPrompt: cleanPrompt,
      enhancedPrompt: enhancedPrompt,
      style: style,
      engine: engineUsed,
      plan: auth.plan,
      quotaRemaining: auth.quota.remaining
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Image Generation Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
