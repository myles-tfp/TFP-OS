"use client";

import { useMemo, useState } from "react";

export type CalEvent = {
  date: string; // yyyy-mm-dd
  locationId: string;
  locationName: string;
  title: string;
  status: string;
};

/** Stable brand-friendly palette; a location keeps its color forever. */
const PALETTE = [
  "#BEE515", "#007281", "#F15A29", "#7FB5FF",
  "#E8A5FF", "#FFD166", "#4BE0C4", "#FF8FA3",
];

function hashColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function StatusCalendar({ events }: { events: CalEvent[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    }
    return map;
  }, [events]);

  const monthLocations = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const map = new Map<string, string>();
    for (const e of events) {
      if (e.date.startsWith(prefix)) map.set(e.locationId, e.locationName);
    }
    return [...map.entries()];
  }, [events, year, month]);

  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const nav = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const cells: (number | null)[] = [
    ...Array<null>(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} title="Previous month">‹</button>
        <h3>
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button type="button" className="icon-btn" onClick={() => nav(1)} title="Next month">›</button>
      </div>

      <div className="cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div className="cal-dow" key={d}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div className="cal-cell empty" key={`e${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = byDay.get(key) ?? [];
          const shown = dayEvents.slice(0, 3);
          const extra = dayEvents.length - shown.length;
          return (
            <div className={`cal-cell${key === todayKey ? " today" : ""}`} key={key}>
              <span className="cal-daynum">{day}</span>
              {shown.map((e, j) => (
                <span
                  key={j}
                  className={`cal-event${e.status === "done" ? " done" : ""}`}
                  style={{ background: `${hashColor(e.locationId)}26`, borderColor: hashColor(e.locationId) }}
                  title={`${e.locationName} — ${e.title} (${e.status.replace("_", " ")})`}
                >
                  {e.locationName}
                </span>
              ))}
              {extra > 0 && (
                <span
                  className="cal-more"
                  title={dayEvents
                    .slice(3)
                    .map((e) => `${e.locationName} — ${e.title}`)
                    .join("\n")}
                >
                  +{extra} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      {monthLocations.length > 0 && (
        <div className="cal-legend">
          {monthLocations.map(([id, name]) => (
            <span className="cal-key" key={id}>
              <span className="cal-swatch" style={{ background: hashColor(id) }} />
              {name}
            </span>
          ))}
        </div>
      )}
      {events.length === 0 && (
        <p className="panel-note" style={{ marginTop: 10 }}>
          No due dates yet — add due dates to board tasks and they land here,
          color-coded by location.
        </p>
      )}
    </div>
  );
}
