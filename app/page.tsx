import { getKpis, getMairies, SORT_KEYS, type SortKey } from "@/lib/db";
import { RgaaPie, CoverageFunnel } from "@/components/charts";
import {
  Database, Send, Activity, ShieldCheck, ExternalLink, Mail, Search,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Globe, FileText,
  Check, Minus, AtSign, FlaskConical, BadgeCheck, AlertTriangle, PieChart, BarChart3,
  Gauge, Award,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SP = {
  q?: string; rgaa?: string; contacted?: string;
  page?: string; sort?: string; dir?: string; f?: string;
};
type Props = { searchParams: Promise<SP> };

const STATUS_LABEL: Record<string, string> = {
  non_conforme: "non conforme",
  partiellement: "partiellement",
  totalement: "totalement",
  aucune_mention: "aucune mention",
  fetch_error: "fetch error",
};

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const rgaa = sp.rgaa ?? "";
  const contacted = sp.contacted ?? "";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 50;
  const sort: SortKey = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "code_insee";
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";

  const [kpis, { rows, total }] = await Promise.all([
    getKpis(),
    getMairies({ search, rgaa, contacted, sort, dir, page, pageSize }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const baseParams = (overrides: Record<string, string | number>) => {
    const merged: Record<string, string | number> = {
      q: search, rgaa, contacted, sort, dir, page, ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v === "" || v === undefined || v === null) continue;
      if (k === "page" && Number(v) === 1) continue;
      if (k === "sort" && v === "code_insee") continue;
      if (k === "dir" && v === "asc") continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  const sortHref = (col: SortKey) => {
    if (col === sort) return baseParams({ sort: col, dir: dir === "asc" ? "desc" : "asc", page: 1 });
    return baseParams({ sort: col, dir: "asc", page: 1 });
  };
  const SortIcon = ({ col }: { col: SortKey }) =>
    col !== sort ? <ArrowUpDown size={11} className="sort-icon-muted" /> :
    dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />;

  return (
    <main className="container">
      <div className="header">
        <div className="brand">
          <span className="brand-mark"><ShieldCheck size={16} strokeWidth={2.5} /></span>
          <h1>conform-rgaa dashboard</h1>
        </div>
        <span className="meta">
          Mis à jour : {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · Cap 10/jour
        </span>
      </div>

      <div className="charts-grid">
        <div className="panel chart-panel">
          <div className="panel-title">
            <span className="left"><PieChart size={16} /> Répartition RGAA</span>
            <span className="meta-mini">{kpis.tested.toLocaleString("fr-FR")} mairies testées</span>
          </div>
          <RgaaPie
            status_non={kpis.status_non}
            status_part={kpis.status_part}
            status_tot={kpis.status_tot}
            status_aucune={kpis.status_aucune}
            status_error={kpis.status_error}
          />
        </div>
        <div className="panel chart-panel">
          <div className="panel-title">
            <span className="left"><BarChart3 size={16} /> Couverture</span>
            <span className="meta-mini">de la base au contact</span>
          </div>
          <CoverageFunnel
            total={kpis.total}
            with_email={kpis.with_email}
            with_site={kpis.with_site}
            audit_done={kpis.audit_done}
            tested={kpis.tested}
            contacted_total={kpis.contacted_total}
          />
        </div>
      </div>

      <div className="kpi-grid">
        {/* Volumes */}
        <Kpi color="muted"  icon={<Database size={20} />}      label="Mairies"        value={kpis.total}            sub={`${kpis.with_site.toLocaleString("fr-FR")} avec site`} />
        <Kpi color="blue"   icon={<AtSign size={20} />}        label="Emails"         value={kpis.with_email}       sub={`${pct(kpis.with_email, kpis.total)}% des mairies`} />
        <Kpi color="blue"   icon={<Globe size={20} />}         label="Sites web"      value={kpis.with_site}        sub={`${pct(kpis.with_site, kpis.total)}% des mairies`} />

        {/* Mention légale RGAA (rgaa-ia) — somme des 4 status = kpis.tested */}
        <Kpi color="muted"  icon={<FlaskConical size={20} />}  label="Testées mention" value={kpis.tested}          sub={`par rgaa-ia · ${pct(kpis.tested, kpis.with_site)}% des sites`} />
        <Kpi color="green"  icon={<BadgeCheck size={20} />}    label="Mention totale"  value={kpis.status_tot}      sub={`${pct(kpis.status_tot, kpis.tested)}% des testées`} />
        <Kpi color="yellow" icon={<AlertTriangle size={20} />} label="Mention partielle" value={kpis.status_part}   sub={`${pct(kpis.status_part, kpis.tested)}% des testées`} />
        <Kpi color="red"    icon={<Activity size={20} />}      label="Mention non conf." value={kpis.status_non}    sub={`${pct(kpis.status_non, kpis.tested)}% des testées`} />
        <Kpi color="muted"  icon={<Minus size={20} />}         label="Aucune mention"  value={kpis.status_aucune}   sub={`${pct(kpis.status_aucune, kpis.tested)}% des testées`} />

        {/* Audit technique 44 critères (Playwright + axe-core) */}
        <Kpi color="muted"  icon={<Gauge size={20} />}         label="Audités 44 crit." value={kpis.audit_done}     sub={`par axe-core · ${pct(kpis.audit_done, kpis.with_site)}% des sites`} />
        <Kpi color={scoreColor(kpis.audit_avg_score)} icon={<Award size={20} />} label="Score 44 crit. moyen" value={kpis.audit_avg_score} suffix="%" sub={`${kpis.audit_conforme} conf · ${kpis.audit_partiel} part · ${kpis.audit_non_conforme} NC`} />

        {/* Contact */}
        <Kpi color="yellow" icon={<FileText size={20} />}      label="Pool envoi"     value={kpis.send_pool}        sub="non_conforme + partiellement, non contactés" />
        <Kpi color="green"  icon={<Send size={20} />}          label="Envoyés"        value={kpis.contacted_total}  sub={`aujourd'hui : ${kpis.contacted_today}/10`} />
      </div>

      <form className="panel filters" action="/" method="get">
        <input type="hidden" name="f" value="1" />
        <div className="filters-row">
          <label className="search-input">
            <Search size={14} />
            <input name="q" defaultValue={search} placeholder="Recherche : nom, code INSEE ou email" />
          </label>
          <select name="rgaa" defaultValue={rgaa}>
            <option value="">Statut RGAA (tous)</option>
            <option value="non_conforme">non conforme</option>
            <option value="partiellement">partiellement</option>
            <option value="totalement">totalement</option>
            <option value="aucune_mention">aucune mention</option>
            <option value="fetch_error">fetch error</option>
          </select>
          <select name="contacted" defaultValue={contacted}>
            <option value="">Contact (tous)</option>
            <option value="yes">contactés</option>
            <option value="no">non contactés</option>
          </select>
          <button type="submit">Filtrer</button>
          {(search || rgaa || contacted) && <a className="clear" href="/">Reset</a>}
        </div>
      </form>

      <div className="panel">
        <div className="panel-title">
          <span className="left"><Database size={16} /> Mairies ({total.toLocaleString("fr-FR")}) · page {page}/{totalPages}</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty">Aucune mairie ne correspond aux filtres.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th><a className="sortable" href={sortHref("code_insee")}><span>INSEE</span><SortIcon col="code_insee" /></a></th>
                  <th><a className="sortable" href={sortHref("nom")}><span>Mairie</span><SortIcon col="nom" /></a></th>
                  <th><a className="sortable" href={sortHref("email")}><span>Email</span><SortIcon col="email" /></a></th>
                  <th><a className="sortable" href={sortHref("site_url")}><span>Site</span><SortIcon col="site_url" /></a></th>
                  <th><a className="sortable" href={sortHref("rgaa_status")}><span>RGAA</span><SortIcon col="rgaa_status" /></a></th>
                  <th><span className="th-static">Score</span></th>
                  <th><span className="th-static">Footer</span></th>
                  <th><span className="th-static">Page dédiée</span></th>
                  <th><a className="sortable" href={sortHref("contacted_at")}><span>Envoyé</span><SortIcon col="contacted_at" /></a></th>
                  <th><a className="sortable" href={sortHref("template_used")}><span>Template</span><SortIcon col="template_used" /></a></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code_insee}>
                    <td className="mono">{r.code_insee}</td>
                    <td className="strong">{cleanName(r.nom)}</td>
                    <td>
                      {r.email ? (
                        <a href={`mailto:${r.email}`} className="link-cell">
                          <Mail size={11} /><span className="truncate">{r.email}</span>
                        </a>
                      ) : <span className="dash">—</span>}
                    </td>
                    <td>
                      {r.site_url ? (
                        <a href={r.site_url} target="_blank" rel="noopener noreferrer" className="link-cell">
                          <Globe size={11} /><span className="truncate">{shortHost(r.site_url)}</span>
                          <ExternalLink size={11} />
                        </a>
                      ) : <span className="dash">—</span>}
                    </td>
                    <td>
                      {r.rgaa_status ? (
                        <span className={`badge rgaa-${r.rgaa_status}`}>
                          {STATUS_LABEL[r.rgaa_status] ?? r.rgaa_status}
                        </span>
                      ) : <span className="dash">—</span>}
                    </td>
                    <td>
                      {r.audit_score_pct === null ? (
                        <span className="dash">—</span>
                      ) : r.audit_conformity === "erreur" ? (
                        <span className="badge rgaa-aucune_mention">erreur</span>
                      ) : (
                        <span className={`badge rgaa-${scoreBadgeClass(r.audit_conformity)}`}>
                          {r.audit_score_pct}%
                        </span>
                      )}
                    </td>
                    <td className="center-cell">
                      {r.rgaa_in_footer === true ? (
                        <Check size={14} className="check-yes" />
                      ) : r.rgaa_in_footer === false ? (
                        <Minus size={14} className="check-no" />
                      ) : <span className="dash">—</span>}
                    </td>
                    <td>
                      {r.rgaa_page_url ? (
                        <a href={r.rgaa_page_url} target="_blank" rel="noopener noreferrer" className="link-cell">
                          <Check size={12} className="check-yes" />
                          <span className="truncate">{shortPath(r.rgaa_page_url)}</span>
                          <ExternalLink size={11} />
                        </a>
                      ) : <span className="dash">—</span>}
                    </td>
                    <td>
                      {r.contacted_at ? (
                        <span className="mono">{new Date(r.contacted_at).toISOString().slice(0, 16).replace("T", " ")}</span>
                      ) : <span className="dash">—</span>}
                    </td>
                    <td className="muted-cell">{r.template_used ?? <span className="dash">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pager">
          <a className={`btn ${page <= 1 ? "disabled" : ""}`} href={baseParams({ page: Math.max(1, page - 1) })}>
            <ChevronLeft size={14} /> Préc.
          </a>
          <span className="pager-info">Page <strong>{page}</strong> / {totalPages}</span>
          <a className={`btn ${page >= totalPages ? "disabled" : ""}`} href={baseParams({ page: Math.min(totalPages, page + 1) })}>
            Suiv. <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </main>
  );
}

function pct(part: number, whole: number): string {
  if (!whole) return "0";
  return ((part / whole) * 100).toFixed(1);
}

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function scoreBadgeClass(conformity: string | null): string {
  if (conformity === "conforme") return "totalement";
  if (conformity === "partiel") return "partiellement";
  if (conformity === "non_conforme") return "non_conforme";
  return "aucune_mention";
}

function shortHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url.slice(0, 40); }
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/$/, "") || u.host.replace(/^www\./, "")).slice(0, 36);
  } catch { return url.slice(0, 36); }
}

function cleanName(n: string): string {
  // "Mairie - X", "Mairie déléguée - X", "Mairie - X - annexe Y" → X
  return n.replace(/^Mairie(?:\s+d[ée]l[ée]gu[ée]e?)?\s*-\s*/i, "");
}

function Kpi({ icon, label, value, sub, color, suffix }: {
  icon: React.ReactNode; label: string; value: number; sub?: string;
  color: "blue" | "yellow" | "green" | "red" | "muted";
  suffix?: string;
}) {
  return (
    <div className={`kpi icon-${color}`}>
      <span className="icon">{icon}</span>
      <div className="body">
        <div className="label">{label}</div>
        <div className="value">{value.toLocaleString("fr-FR")}{suffix ?? ""}</div>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
    </div>
  );
}
