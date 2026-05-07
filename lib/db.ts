import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function countMairies(filter?: (q: any) => any): Promise<number> {
  const c = client();
  let q: any = c.from("mairies").select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function countLatestAudits(filter?: (q: any) => any): Promise<number> {
  const c = client();
  let q: any = c.from("mairie_latest_audit").select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function avgLatestAuditScore(): Promise<number> {
  const c = client();
  const PAGE = 1000;
  let from = 0;
  let sum = 0;
  let n = 0;
  // Paginate through mairie_latest_audit, summing score_pct (skip nulls).
  // The view holds at most ~21k rows (1 per audited mairie), so this is bounded.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await c
      .from("mairie_latest_audit")
      .select("score_pct")
      .not("score_pct", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as { score_pct: number | null }[]) ?? [];
    for (const r of rows) {
      if (r.score_pct != null) { sum += r.score_pct; n += 1; }
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return n === 0 ? 0 : Math.round(sum / n);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type Kpis = {
  total: number;
  with_email: number;
  with_site: number;
  scrape_pending: number;
  tested: number;
  status_non: number;
  status_part: number;
  status_tot: number;
  status_aucune: number;
  status_error: number;
  send_pool: number;
  contacted_today: number;
  contacted_total: number;
  audit_done: number;
  audit_avg_score: number;
  audit_conforme: number;
  audit_partiel: number;
  audit_non_conforme: number;
  audit_erreur: number;
};

export async function getKpis(): Promise<Kpis> {
  const todayUtc = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )).toISOString();

  const [
    total, with_email, with_site, scrape_pending, tested,
    status_non, status_part, status_tot, status_aucune, status_error,
    send_pool, contacted_today, contacted_total,
    audit_done, audit_avg_score,
    audit_conforme, audit_partiel, audit_non_conforme, audit_erreur,
  ] = await Promise.all([
    countMairies(),
    countMairies((q) => q.not("email", "is", null)),
    countMairies((q) => q.not("site_url", "is", null)),
    countMairies((q) => q.not("site_url", "is", null).is("scraped_rgaa_at", null)),
    countMairies((q) => q.not("scraped_rgaa_at", "is", null)),
    countMairies((q) => q.eq("rgaa_status", "non_conforme")),
    countMairies((q) => q.eq("rgaa_status", "partiellement")),
    countMairies((q) => q.eq("rgaa_status", "totalement")),
    countMairies((q) => q.eq("rgaa_status", "aucune_mention")),
    countMairies((q) => q.eq("rgaa_status", "fetch_error")),
    countMairies((q) =>
      q.not("email", "is", null)
       .in("rgaa_status", ["non_conforme", "partiellement"])
       .is("contacted_at", null)
       .is("unsubscribed_at", null)
    ),
    countMairies((q) => q.gte("contacted_at", todayUtc)),
    countMairies((q) => q.not("contacted_at", "is", null)),
    countLatestAudits((q) => q.not("score_pct", "is", null)),
    avgLatestAuditScore(),
    countLatestAudits((q) => q.eq("conformity", "conforme")),
    countLatestAudits((q) => q.eq("conformity", "partiel")),
    countLatestAudits((q) => q.eq("conformity", "non_conforme")),
    countLatestAudits((q) => q.eq("conformity", "erreur")),
  ]);

  return {
    total, with_email, with_site, scrape_pending, tested,
    status_non, status_part, status_tot, status_aucune, status_error,
    send_pool, contacted_today, contacted_total,
    audit_done, audit_avg_score,
    audit_conforme, audit_partiel, audit_non_conforme, audit_erreur,
  };
}

export type MairieRow = {
  code_insee: string;
  nom: string;
  email: string | null;
  site_url: string | null;
  rgaa_status: string | null;
  rgaa_page_url: string | null;
  rgaa_in_footer: boolean | null;
  contacted_at: string | null;
  template_used: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  audit_score_pct: number | null;
  audit_conformity: string | null;
  audit_at: string | null;
};

export type SortKey =
  | "code_insee" | "nom" | "email" | "site_url"
  | "rgaa_status" | "rgaa_in_footer" | "rgaa_page_url"
  | "contacted_at" | "template_used";
export const SORT_KEYS: SortKey[] = [
  "code_insee", "nom", "email", "site_url",
  "rgaa_status", "rgaa_in_footer", "rgaa_page_url",
  "contacted_at", "template_used",
];

export type Filters = {
  search?: string;
  rgaa?: string;
  contacted?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const COLUMNS = "code_insee,nom,email,site_url,rgaa_status,rgaa_page_url,rgaa_in_footer,contacted_at,template_used,replied_at,bounced_at";

export async function getMairies(f: Filters): Promise<{ rows: MairieRow[]; total: number; page: number; pageSize: number }> {
  const c = client();
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const search = (f.search ?? "").trim();
  const rgaa = ["non_conforme", "partiellement", "totalement", "aucune_mention", "fetch_error"].includes(f.rgaa ?? "")
    ? f.rgaa! : null;
  const contacted = f.contacted === "yes" ? "yes" : f.contacted === "no" ? "no" : null;
  const sort: SortKey = SORT_KEYS.includes(f.sort as SortKey) ? (f.sort as SortKey) : "code_insee";
  const dir: "asc" | "desc" = f.dir === "desc" ? "desc" : "asc";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = c.from("mairies").select(COLUMNS, { count: "exact" });

  if (search) {
    // PostgREST `or` syntax — escape commas in user input by replacing with %2C is not needed for ilike values
    // but we do need to ensure the value doesn't contain commas/parens which terminate the or() argument.
    const safe = search.replace(/[,()*]/g, " ");
    q = q.or(`nom.ilike.%${safe}%,code_insee.eq.${safe},email.ilike.%${safe}%`);
  }
  if (rgaa) q = q.eq("rgaa_status", rgaa);
  if (contacted === "yes") q = q.not("contacted_at", "is", null);
  if (contacted === "no")  q = q.is("contacted_at", null);

  q = q.order(sort, { ascending: dir === "asc", nullsFirst: false }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;

  const baseRows = ((data as Omit<MairieRow, "audit_score_pct" | "audit_conformity" | "audit_at">[]) ?? [])
    .map((r) => ({ ...r, audit_score_pct: null, audit_conformity: null, audit_at: null } as MairieRow));

  if (baseRows.length > 0) {
    const codes = baseRows.map((r) => r.code_insee);
    const { data: auditData, error: auditErr } = await c
      .from("mairie_latest_audit")
      .select("code_insee,score_pct,conformity,audited_at")
      .in("code_insee", codes);
    if (auditErr) throw auditErr;
    const byCode = new Map<string, { score_pct: number | null; conformity: string | null; audited_at: string | null }>();
    for (const a of (auditData ?? []) as { code_insee: string; score_pct: number | null; conformity: string | null; audited_at: string | null }[]) {
      byCode.set(a.code_insee, { score_pct: a.score_pct, conformity: a.conformity, audited_at: a.audited_at });
    }
    for (const r of baseRows) {
      const a = byCode.get(r.code_insee);
      if (a) {
        r.audit_score_pct = a.score_pct;
        r.audit_conformity = a.conformity;
        r.audit_at = a.audited_at;
      }
    }
  }

  return { rows: baseRows, total: count ?? 0, page, pageSize };
}
