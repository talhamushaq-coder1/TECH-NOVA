/**
 * Cloudflare Worker for TECHNOVA E-Commerce Storefront
 * Handles static asset delivery, SPA fallback routing, and health checks.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/api/health' || url.pathname === '/healthz') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'technova-storefront',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Static Assets Binding (env.ASSETS) configured in wrangler.toml [assets]
    if (env && env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }

        // Single Page App fallback: if asset 404 and not a file with extension, serve index.html
        if (!url.pathname.includes('.')) {
          const spaRequest = new Request(new URL('/index.html', request.url), request);
          return await env.ASSETS.fetch(spaRequest);
        }

        return assetResponse;
      } catch (err) {
        return new Response('Asset Fetch Error: ' + (err && err.message ? err.message : String(err)), {
          status: 500
        });
      }
    }

    // Informative fallback response if worker is invoked without assets binding
    return new Response('TECHNOVA Worker Active. Please ensure static assets are built into ./dist directory.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};
