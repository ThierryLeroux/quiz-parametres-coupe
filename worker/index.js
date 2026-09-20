// Serveur du quiz : un Worker Cloudflare (décisions D19 et D20).
//   /api/…  → l'API du serveur de correction, en JSON
//   le reste → les fichiers de site/, servis tels quels (liaison ASSETS de wrangler.jsonc)
//
// Pour l'instant l'API ne sait dire que sa version : identification, question, correction et
// rapport arrivent au jalon 3 (PLAN.md). En attendant, tout autre chemin /api/ répond 501, et
// le site affiche « Serveur de correction à venir ».

import pkg from '../package.json' with { type: 'json' };

// Réponse JSON, jamais mise en cache : une réponse de l'API ne vaut que pour l'instant présent.
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (pathname === '/api/version' && request.method === 'GET') return json({ version: pkg.version });
    return json({ erreur: "Le serveur de correction n'est pas encore en service." }, 501);
  },
};
