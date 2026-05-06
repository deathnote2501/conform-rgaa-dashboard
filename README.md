# conform-rgaa-dashboard

Dashboard Next.js pour visualiser le travail de l'agent
[conform-rgaa-agent](/opt/conform-rgaa-agent). Une seule page : KPIs +
table mairies filtrable / triable / paginée.

## Stack

- Next.js 16 (App Router) sur Vercel
- `@supabase/supabase-js` (PostgREST sur HTTPS — IPv4-friendly depuis Vercel)
- Auth email/mdp via cookie HMAC signé (même pattern que vps-acquire-dashboard)

## Variables d'environnement

- `SUPABASE_URL` — `https://<project_ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (secret, depuis Supabase
  dashboard → Settings → API). Le dashboard est read-only par convention,
  mais utilise le service role pour bypasser RLS.
- `DASHBOARD_USER` — email de connexion
- `DASHBOARD_PASS` — mot de passe
- `COOKIE_SECRET` — secret aléatoire (>=32 chars) pour signer les sessions
  (`openssl rand -hex 32`)

> **Note** : la connexion Postgres directe (`postgresql://db.<ref>.supabase.co`)
> est en IPv6-only sur les nouveaux projets Supabase et ne marche pas depuis
> Vercel functions. On passe par PostgREST/HTTPS pour contourner.

## Local dev

```bash
npm install
cp .env.example .env.local   # remplir les 4 vars
npm run dev
```

## Schéma attendu

Le dashboard lit la table `mairies` créée par
`/opt/conform-rgaa-agent/infra/migrations/001_mairies.sql`. Colonnes utilisées :
`code_insee, nom, email, site_url, rgaa_status, rgaa_page_url,
contacted_at, template_used, replied_at, bounced_at, unsubscribed_at`.

## Filtres

- **Recherche libre** : sur `nom`, `code_insee` ou `email`.
- **Statut RGAA** : non_conforme / partiellement / totalement / aucune_mention / fetch_error.
- **Contact** : contactés / non contactés.
- **Tri** : sur 7 colonnes (INSEE, mairie, email, site, RGAA, envoyé, template).

## Sécurité

Le dashboard utilise le service_role pour Supabase, qui bypasse Row Level
Security. Le code n'expose que `SELECT` sur `mairies` via les fonctions
de `lib/db.ts` (aucun mutation/RPC). Pour un cran de plus, activer RLS
sur `mairies` et créer un rôle restreint plutôt que d'utiliser le
service_role — mais ça nécessite de changer le client (anon key + RLS
SELECT policy).
