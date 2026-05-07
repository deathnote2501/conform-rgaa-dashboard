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
  audit_done: number;
  audit_pending: number;
  audit_avg_score: number;
  audit_conforme: number;
  audit_partiel: number;
  audit_non_conforme: number;
  audit_erreur: number;
  send_pool: number;
  contacted_today: number;
  contacted_total: number;
};

export async function getKpis(): Promise<Kpis> {
  const todayUtc = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )).toISOString();

  const [
    total, with_email, with_site,
    audit_done, audit_avg_score,
    audit_conforme, audit_partiel, audit_non_conforme, audit_erreur,
    contacted_today, contacted_total,
  ] = await Promise.all([
    countMairies(),
    countMairies((q) => q.not("email", "is", null)),
    countMairies((q) => q.not("site_url", "is", null)),
    countLatestAudits((q) => q.not("score_pct", "is", null)),
    avgLatestAuditScore(),
    countLatestAudits((q) => q.eq("conformity", "conforme")),
    countLatestAudits((q) => q.eq("conformity", "partiel")),
    countLatestAudits((q) => q.eq("conformity", "non_conforme")),
    countLatestAudits((q) => q.eq("conformity", "erreur")),
    countMairies((q) => q.gte("contacted_at", todayUtc)),
    countMairies((q) => q.not("contacted_at", "is", null)),
  ]);

  // send_pool : mairies non_conforme (audit rgaa-ia.fr) avec email, jamais contactées.
  // Pas de NOT IN trivial côté PostgREST → on calcule à partir des comptages au-dessus
  // après avoir récupéré la liste des code_insee non_conforme + uncontacted via une jointure côté client.
  const send_pool = await computeSendPool();

  const audit_pending = Math.max(0, with_site - audit_done);

  return {
    total, with_email, with_site,
    audit_done, audit_pending, audit_avg_score,
    audit_conforme, audit_partiel, audit_non_conforme, audit_erreur,
    send_pool, contacted_today, contacted_total,
  };
}

async function computeSendPool(): Promise<number> {
  const c = client();
  // Liste des code_insee non_conforme par rgaa-ia.fr
  const { data: ncCodes, error: ncErr } = await c
    .from("mairie_latest_audit")
    .select("code_insee")
    .eq("conformity", "non_conforme")
    .is("error_reason", null);
  if (ncErr) throw ncErr;
  const codes = (ncCodes ?? []).map((r: { code_insee: string }) => r.code_insee);
  if (codes.length === 0) return 0;
  // Filtre : email non null + non contactée + non désinscrite
  const { count, error } = await c
    .from("mairies")
    .select("*", { count: "exact", head: true })
    .in("code_insee", codes)
    .not("email", "is", null)
    .is("contacted_at", null)
    .is("unsubscribed_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type MairieRow = {
  code_insee: string;
  nom: string;
  email: string | null;
  site_url: string | null;
  rgaa_in_footer: boolean | null;
  rgaa_page_url: string | null;
  contacted_at: string | null;
  template_used: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  audit_score_pct: number | null;
  audit_conformity: string | null;
  audit_at: string | null;
  audit_url: string | null;
};

export type SortKey =
  | "code_insee" | "nom" | "email" | "site_url"
  | "rgaa_in_footer" | "rgaa_page_url"
  | "contacted_at" | "template_used";
export const SORT_KEYS: SortKey[] = [
  "code_insee", "nom", "email", "site_url",
  "rgaa_in_footer", "rgaa_page_url",
  "contacted_at", "template_used",
];

export type Filters = {
  search?: string;
  conformity?: string;
  contacted?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

const COLUMNS = "code_insee,nom,email,site_url,rgaa_in_footer,rgaa_page_url,contacted_at,template_used,replied_at,bounced_at";

export async function getMairies(f: Filters): Promise<{ rows: MairieRow[]; total: number; page: number; pageSize: number }> {
  const c = client();
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, f.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const search = (f.search ?? "").trim();
  const conformity = ["conforme", "partiel", "non_conforme", "erreur"].includes(f.conformity ?? "")
    ? f.conformity! : null;
  const contacted = f.contacted === "yes" ? "yes" : f.contacted === "no" ? "no" : null;
  const sort: SortKey = SORT_KEYS.includes(f.sort as SortKey) ? (f.sort as SortKey) : "code_insee";
  const dir: "asc" | "desc" = f.dir === "desc" ? "desc" : "asc";

  // Si filtre sur conformity, on pré-récupère les code_insee correspondants
  // (jointure côté client puisque l'audit vit dans une vue séparée).
  let conformityCodes: string[] | null = null;
  if (conformity) {
    const { data, error } = await c
      .from("mairie_latest_audit")
      .select("code_insee")
      .eq("conformity", conformity);
    if (error) throw error;
    conformityCodes = (data ?? []).map((r: { code_insee: string }) => r.code_insee);
    // Si liste vide, court-circuit : aucun résultat possible
    if (conformityCodes.length === 0) {
      return { rows: [], total: 0, page, pageSize };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = c.from("mairies").select(COLUMNS, { count: "exact" });

  if (search) {
    const safe = search.replace(/[,()*]/g, " ");
    q = q.or(`nom.ilike.%${safe}%,code_insee.eq.${safe},email.ilike.%${safe}%`);
  }
  if (conformityCodes) q = q.in("code_insee", conformityCodes);
  if (contacted === "yes") q = q.not("contacted_at", "is", null);
  if (contacted === "no")  q = q.is("contacted_at", null);

  q = q.order(sort, { ascending: dir === "asc", nullsFirst: false }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;

  const baseRows = ((data as Omit<MairieRow, "audit_score_pct" | "audit_conformity" | "audit_at" | "audit_url">[]) ?? [])
    .map((r) => ({ ...r, audit_score_pct: null, audit_conformity: null, audit_at: null, audit_url: null } as MairieRow));

  if (baseRows.length > 0) {
    const codes = baseRows.map((r) => r.code_insee);
    const { data: auditData, error: auditErr } = await c
      .from("mairie_latest_audit")
      .select("code_insee,score_pct,conformity,audited_at,audit_url")
      .in("code_insee", codes);
    if (auditErr) throw auditErr;
    const byCode = new Map<string, { score_pct: number | null; conformity: string | null; audited_at: string | null; audit_url: string | null }>();
    for (const a of (auditData ?? []) as { code_insee: string; score_pct: number | null; conformity: string | null; audited_at: string | null; audit_url: string | null }[]) {
      byCode.set(a.code_insee, { score_pct: a.score_pct, conformity: a.conformity, audited_at: a.audited_at, audit_url: a.audit_url });
    }
    for (const r of baseRows) {
      const a = byCode.get(r.code_insee);
      if (a) {
        r.audit_score_pct = a.score_pct;
        r.audit_conformity = a.conformity;
        r.audit_at = a.audited_at;
        r.audit_url = a.audit_url;
      }
    }
  }

  return { rows: baseRows, total: count ?? 0, page, pageSize };
}
