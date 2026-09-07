export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health' || url.pathname === '/healthz') {
      return new Response(JSON.stringify({ status: 'ok', service: 'technova' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
