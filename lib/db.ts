import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function sql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _sql = postgres(url, { ssl: "require", prepare: false, max: 5, idle_timeout: 20 });
  return _sql;
}

export type Kpis = {
  total: number;
  with_email: number;
  with_site: number;
  scrape_pending: number;
  status_non: number;
  status_part: number;
  status_tot: number;
  status_aucune: number;
  status_error: number;
  send_pool: number;
  contacted_today: number;
  contacted_total: number;
};

export async function getKpis(): Promise<Kpis> {
  const s = sql();
  const [r] = (await s`
    SELECT
      (SELECT count(*) FROM mairies)                                                  AS total,
      (SELECT count(*) FROM mairies WHERE email IS NOT NULL)                           AS with_email,
      (SELECT count(*) FROM mairies WHERE site_url IS NOT NULL)                        AS with_site,
      (SELECT count(*) FROM mairies WHERE site_url IS NOT NULL AND scraped_rgaa_at IS NULL) AS scrape_pending,
      (SELECT count(*) FROM mairies WHERE rgaa_status='non_conforme')                  AS status_non,
      (SELECT count(*) FROM mairies WHERE rgaa_status='partiellement')                 AS status_part,
      (SELECT count(*) FROM mairies WHERE rgaa_status='totalement')                    AS status_tot,
      (SELECT count(*) FROM mairies WHERE rgaa_status='aucune_mention')                AS status_aucune,
      (SELECT count(*) FROM mairies WHERE rgaa_status='fetch_error')                   AS status_error,
      (SELECT count(*) FROM mairies
        WHERE email IS NOT NULL
          AND rgaa_status IN ('non_conforme','partiellement')
          AND contacted_at IS NULL AND unsubscribed_at IS NULL)                        AS send_pool,
      (SELECT count(*) FROM mairies
        WHERE contacted_at >= date_trunc('day', now() at time zone 'UTC'))             AS contacted_today,
      (SELECT count(*) FROM mairies WHERE contacted_at IS NOT NULL)                    AS contacted_total
  `) as Array<Record<string, string | number>>;
  const num = (k: string) => Number(r[k] ?? 0);
  return {
    total: num("total"),
    with_email: num("with_email"),
    with_site: num("with_site"),
    scrape_pending: num("scrape_pending"),
    status_non: num("status_non"),
    status_part: num("status_part"),
    status_tot: num("status_tot"),
    status_aucune: num("status_aucune"),
    status_error: num("status_error"),
    send_pool: num("send_pool"),
    contacted_today: num("contacted_today"),
    contacted_total: num("contacted_total"),
  };
}

export type MairieRow = {
  code_insee: string;
  nom: string;
  email: string | null;
  site_url: string | null;
  rgaa_status: string | null;
  rgaa_page_url: string | null;
  contacted_at: string | null;
  template_used: string | null;
  replied_at: string | null;
  bounced_at: string | null;
};

export type SortKey =
  | "code_insee" | "nom" | "email" | "site_url"
  | "rgaa_status" | "contacted_at" | "template_used";
export const SORT_KEYS: SortKey[] = [
  "code_insee", "nom", "email", "site_url",
  "rgaa_status", "contacted_at", "template_used",
];

export type Filters = {
  search?: string;
  rgaa?: string;       // non_conforme | partiellement | totalement | aucune_mention | fetch_error
  contacted?: string;  // yes | no
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function getMairies(f: Filters): Promise<{ rows: MairieRow[]; total: number; page: number; pageSize: number }> {
  const s = sql();
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const search = (f.search ?? "").trim();
  const rgaa = ["non_conforme", "partiellement", "totalement", "aucune_mention", "fetch_error"].includes(f.rgaa ?? "")
    ? f.rgaa! : null;
  const contacted = f.contacted === "yes" ? "yes" : f.contacted === "no" ? "no" : null;
  const sort: SortKey = SORT_KEYS.includes(f.sort as SortKey) ? (f.sort as SortKey) : "code_insee";
  const dir: "asc" | "desc" = f.dir === "desc" ? "desc" : "asc";

  // Build conditions
  const conditions: ReturnType<typeof s>[] = [];
  if (search) {
    const like = `%${search.replace(/[%_]/g, (m) => "\\" + m)}%`;
    conditions.push(s`(nom ILIKE ${like} OR code_insee = ${search} OR email ILIKE ${like})`);
  }
  if (rgaa) conditions.push(s`rgaa_status = ${rgaa}`);
  if (contacted === "yes") conditions.push(s`contacted_at IS NOT NULL`);
  if (contacted === "no") conditions.push(s`contacted_at IS NULL`);

  // Compose the WHERE clause from accumulated fragments using `AND`.
  const where = conditions.length === 0
    ? s``
    : s`WHERE ${conditions.reduce((acc, c, i) => i === 0 ? c : s`${acc} AND ${c}`)}`;

  // Sort/dir validated against whitelists → safe to interpolate via `s.unsafe`.
  const orderBy = s.unsafe(`ORDER BY ${sort} ${dir} NULLS LAST, code_insee ${dir}`);

  const rows = (await s`
    SELECT code_insee, nom, email, site_url,
           rgaa_status, rgaa_page_url,
           contacted_at::text AS contacted_at,
           template_used,
           replied_at::text AS replied_at,
           bounced_at::text AS bounced_at
    FROM mairies
    ${where}
    ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `) as MairieRow[];

  const [{ n }] = (await s`SELECT count(*)::int AS n FROM mairies ${where}`) as Array<{ n: number }>;

  return { rows, total: Number(n), page, pageSize };
}
