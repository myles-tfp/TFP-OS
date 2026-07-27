/** Server-rendered charts for the HQ overview — no chart library needed. */

export type ColumnDatum = {
  locationId: string;
  locationName: string;
  /** 0-based rung index on the y-axis */
  step: number;
  label: string;
};

const PALETTE = [
  "#BEE515", "#007281", "#F15A29", "#7FB5FF",
  "#E8A5FF", "#FFD166", "#4BE0C4", "#FF8FA3",
];
function hashColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Vertical columns: x = locations (scrolls), y = named rungs. */
export function ColumnChart({
  steps,
  data,
}: {
  steps: string[];
  data: ColumnDatum[];
}) {
  const H = 180;
  return (
    <div className="colchart">
      <div className="colchart-y">
        {[...steps].reverse().map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="colchart-scroll">
        <div className="colchart-cols">
          {data.map((d) => {
            const pct = ((d.step + 1) / steps.length) * 100;
            return (
              <div className="colchart-col" key={d.locationId}>
                <div className="colchart-barwrap" style={{ height: H }}>
                  <div
                    className="colchart-bar"
                    style={{
                      height: `${pct}%`,
                      background: `${hashColor(d.locationId)}33`,
                      borderColor: hashColor(d.locationId),
                    }}
                    title={`${d.locationName} — ${d.label}`}
                  />
                </div>
                <span className="colchart-x">{d.locationName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Founders line: x = locations (scrolls), y = % of goal. */
export function FoundersLine({
  points,
}: {
  points: { id: string; name: string; members: number; goal: number }[];
}) {
  if (points.length === 0) return null;
  const colW = 90;
  const H = 170;
  const PAD = 26;
  const W = Math.max(320, points.length * colW);

  const xy = points.map((p, i) => {
    const pct = Math.min(1, (p.members || 0) / (p.goal || 100));
    return {
      ...p,
      pct,
      x: PAD + i * colW + colW / 2,
      y: PAD + (1 - pct) * (H - PAD * 2),
    };
  });
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="linechart-scroll">
      <svg
        width={W}
        height={H + 34}
        viewBox={`0 0 ${W} ${H + 34}`}
        role="img"
        aria-label="Founding members progress by location"
      >
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line
              x1={PAD}
              x2={W - 8}
              y1={PAD + (1 - g) * (H - PAD * 2)}
              y2={PAD + (1 - g) * (H - PAD * 2)}
              stroke="rgba(255,255,255,.08)"
            />
            <text
              x={2}
              y={PAD + (1 - g) * (H - PAD * 2) + 3}
              fill="#74777B"
              fontSize="9"
              fontFamily="Poppins, sans-serif"
            >
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#BEE515" strokeWidth="2" />
        {xy.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="4" fill="#BEE515">
              <title>{`${p.name} — ${p.members}/${p.goal} (${Math.round(p.pct * 100)}%)`}</title>
            </circle>
            <text
              x={p.x}
              y={H + 12}
              textAnchor="middle"
              fill="#D2D2D2"
              fontSize="10"
              fontFamily="Poppins, sans-serif"
            >
              {p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name}
            </text>
            <text
              x={p.x}
              y={H + 26}
              textAnchor="middle"
              fill="#74777B"
              fontSize="9"
              fontFamily="Poppins, sans-serif"
            >
              {p.members}/{p.goal}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
