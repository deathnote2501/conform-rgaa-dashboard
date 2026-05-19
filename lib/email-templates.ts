// Templates miroirs de /opt/conform-rgaa-agent/mail-*.md.
// Substitutions appliquées par render() identiques à send_email.py.

const TPL_NON_CONFORME = {
  subject: "{{nom}} : votre déclaration RGAA et la mise en conformité",
  body: `Bonjour,

La déclaration d'accessibilité publiée par {{nom}} indique un site {{rgaa_status_human}} :
{{rgaa_page_url}}

Depuis le 1er janvier 2024, l'ARCOM contrôle la conformité RGAA (ordonnance 2023-859) et peut, après mise en demeure, prononcer une sanction allant jusqu'à 50 000 € par service en ligne.

Pour faire le point en 60 secondes, un audit RGAA 4.1.2 gratuit (57 critères) :

  → {{rgaa_ia_test_url}}

Bien cordialement,

Jérôme Iavarone
RGAA-IA — https://rgaa-ia.fr
bonjour@rgaa-ia.fr

—
Pour ne plus recevoir de message, répondre "stop".
`,
};

const TPL_PARTIEL = {
  subject: "{{nom}} : finaliser la conformité RGAA de votre site",
  body: `Bonjour,

Votre déclaration d'accessibilité indique un site partiellement conforme :
{{rgaa_page_url}}

L'audit a donc été fait et les écarts sont documentés. Reste à les clôturer avant un éventuel contrôle ARCOM, qui peut prononcer, après mise en demeure, jusqu'à 50 000 € par service en ligne (loi 2005-102 art. 47, modifiée par l'ordonnance 2023-859 du 6 septembre 2023).

Pour réévaluer rapidement où vous en êtes, un audit RGAA 4.1.2 gratuit en 60 secondes (57 critères), avec la liste précise des non-conformités restantes :

  → {{rgaa_ia_test_url}}

Bien cordialement,

Jérôme Iavarone
RGAA-IA — https://rgaa-ia.fr
jerome@rgaa-ia.fr

—
Pour ne plus recevoir de message, répondre "stop".
`,
};

const STATUS_HUMAN: Record<string, string> = {
  non_conforme: "non conforme",
  partiel: "partiellement conforme",
  conforme: "totalement conforme",
  partiellement: "partiellement conforme",
  totalement: "totalement conforme",
  aucune_mention: "sans déclaration RGAA publiée",
};

export type RenderCtx = {
  nom: string;
  email: string | null;
  site_url: string | null;
  rgaa_page_url: string | null;
  rgaa_status: string | null;
  audit_url: string | null;
  audit_score_pct: number | null;
};

export function pickTemplate(templateUsed: string | null, rgaaStatus: string | null) {
  const key = templateUsed ?? "";
  if (key.includes("non_conforme")) return TPL_NON_CONFORME;
  if (key.includes("partiel")) return TPL_PARTIEL;
  if (rgaaStatus === "non_conforme") return TPL_NON_CONFORME;
  return TPL_PARTIEL;
}

export function render(text: string, m: RenderCtx): string {
  const site_url = m.site_url ?? "";
  const rgaa_ia_test_url = site_url
    ? `https://rgaa-ia.fr/?url=${encodeURIComponent(site_url)}`
    : "https://rgaa-ia.fr/";
  return text
    .replaceAll("{{nom}}", m.nom)
    .replaceAll("{{rgaa_status_human}}", STATUS_HUMAN[m.rgaa_status ?? ""] ?? (m.rgaa_status ?? ""))
    .replaceAll("{{rgaa_page_url}}", m.rgaa_page_url ?? m.site_url ?? "")
    .replaceAll("{{site_url}}", site_url)
    .replaceAll("{{rgaa_ia_test_url}}", rgaa_ia_test_url)
    .replaceAll("{{rgaa_audit_url}}", m.audit_url ?? "")
    .replaceAll("{{score_pct}}", m.audit_score_pct == null ? "" : String(m.audit_score_pct));
}
