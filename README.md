# conform-rgaa-dashboard

Dashboard Next.js pour visualiser le travail de l'agent
[conform-rgaa-agent](/opt/conform-rgaa-agent). Une seule page : KPIs +
table mairies filtrable / triable / paginée.

## Stack

- Next.js 16 (App Router) sur Vercel
- `postgres` lib (lit Supabase Postgres en read-only via le rôle de ton choix)
- Auth email/mdp via cookie HMAC signé (même pattern que vps-acquire-dashboard)

## Variables d'environnement

- `DATABASE_URL` — connection string Supabase (idéalement un rôle SELECT-only,
  jamais le service_role). Format :
  `postgresql://USER:PASS@db.PROJECT_REF.supabase.co:5432/postgres`
- `DASHBOARD_USER` — email de connexion
- `DASHBOARD_PASS` — mot de passe
- `COOKIE_SECRET` — secret aléatoire (>=32 chars) pour signer les sessions
  (`openssl rand -hex 32`)

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

Le rôle Postgres derrière `DATABASE_URL` ne devrait avoir que `SELECT` sur
`mairies`. Pour créer un rôle ro côté Supabase :

```sql
CREATE ROLE dashboard_ro WITH LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE postgres TO dashboard_ro;
GRANT USAGE ON SCHEMA public TO dashboard_ro;
GRANT SELECT ON mairies TO dashboard_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_ro;
```
