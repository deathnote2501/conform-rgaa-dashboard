"use client";

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";

const COLORS = {
  blue: "#4285F4",
  yellow: "#FBBC05",
  green: "#34A853",
  red: "#EA4335",
  muted: "#9ca3af",
  redSoft: "#fca5a5",
};

type ConformitySlice = { name: string; value: number; color: string };
type FunnelStep = { name: string; value: number };

export function ConformityPie({
  audit_conforme, audit_partiel, audit_non_conforme, audit_erreur,
}: {
  audit_conforme: number; audit_partiel: number;
  audit_non_conforme: number; audit_erreur: number;
}) {
  const data: ConformitySlice[] = [
    { name: "Conforme",     value: audit_conforme,     color: COLORS.green },
    { name: "Partiel",      value: audit_partiel,      color: COLORS.yellow },
    { name: "Non conforme", value: audit_non_conforme, color: COLORS.red },
    { name: "Erreur",       value: audit_erreur,       color: COLORS.muted },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="chart-empty">Aucun audit pour l&apos;instant.</div>;
  }

  return (
    <div className="chart-with-legend">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const v = Number(value);
              return [`${v.toLocaleString("fr-FR")} (${((v / total) * 100).toFixed(1)}%)`, ""];
            }}
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="chart-legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="dot" style={{ background: d.color }} />
            <span className="lbl">{d.name}</span>
            <span className="val">
              {d.value.toLocaleString("fr-FR")}
              <span className="pct"> · {((d.value / total) * 100).toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoverageFunnel({
  total, with_email, with_site, audit_done, contacted_total,
}: {
  total: number; with_email: number; with_site: number;
  audit_done: number; contacted_total: number;
}) {
  const data: FunnelStep[] = [
    { name: "Mairies",    value: total },
    { name: "Avec email", value: with_email },
    { name: "Avec site",  value: with_site },
    { name: "Auditées",   value: audit_done },
    { name: "Contactées", value: contacted_total },
  ];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, left: 12, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="#f1f3f5" />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          width={108}
        />
        <Tooltip
          formatter={(value) => {
            const v = Number(value);
            return [`${v.toLocaleString("fr-FR")} (${total > 0 ? ((v / total) * 100).toFixed(1) : "0"}%)`, ""];
          }}
          cursor={{ fill: "rgba(66,133,244,0.06)" }}
          contentStyle={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={COLORS.blue} radius={[4, 4, 4, 4]} barSize={20}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value) => Number(value ?? 0).toLocaleString("fr-FR")}
            style={{ fontSize: 11, fill: "#1f2937", fontWeight: 500 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
