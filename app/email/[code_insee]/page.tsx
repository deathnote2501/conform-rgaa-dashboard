import { getMairieByCode } from "@/lib/db";
import { pickTemplate, render } from "@/lib/email-templates";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code_insee: string }> };

export default async function Page({ params }: Props) {
  const { code_insee } = await params;
  const m = await getMairieByCode(code_insee);
  if (!m) notFound();

  const tpl = pickTemplate(m.template_used, m.audit_conformity);
  const subject = render(tpl.subject, {
    nom: m.nom,
    email: m.email,
    site_url: m.site_url,
    rgaa_page_url: m.rgaa_page_url,
    rgaa_status: m.audit_conformity,
    audit_url: m.audit_url,
    audit_score_pct: m.audit_score_pct,
  });
  const body = render(tpl.body, {
    nom: m.nom,
    email: m.email,
    site_url: m.site_url,
    rgaa_page_url: m.rgaa_page_url,
    rgaa_status: m.audit_conformity,
    audit_url: m.audit_url,
    audit_score_pct: m.audit_score_pct,
  });

  const sentDate = m.contacted_at ? new Date(m.contacted_at).toISOString().slice(0, 16).replace("T", " ") : null;

  return (
    <main className="container">
      <div style={{ marginBottom: 16 }}>
        <Link href="/" className="btn"><ArrowLeft size={14} /> Retour</Link>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span className="left"><Mail size={16} /> Email envoyé · {m.code_insee} · {m.nom}</span>
        </div>

        <div className="email-meta">
          <div><strong>À :</strong> {m.email ?? "—"}</div>
          <div><strong>Template :</strong> {m.template_used ?? "—"}</div>
          {sentDate && (
            <div><Calendar size={12} style={{ verticalAlign: "middle" }} /> <strong>Envoyé :</strong> <span className="mono">{sentDate} UTC</span></div>
          )}
          {m.site_url && (
            <div><Globe size={12} style={{ verticalAlign: "middle" }} /> <a href={m.site_url} target="_blank" rel="noopener noreferrer">{m.site_url}</a></div>
          )}
        </div>

        <div className="email-subject">
          <span className="email-label">Sujet</span>
          <div className="email-subject-value">{subject}</div>
        </div>

        <div className="email-body">
          <span className="email-label">Corps</span>
          <pre className="email-body-content">{body}</pre>
        </div>
      </div>
    </main>
  );
}
