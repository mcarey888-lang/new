import { ArrowLeft, Map, Plus, Compass, ChevronRight, Pencil, Trash2, Check, BookmarkIcon, CheckCircle } from "lucide-react";

const T = {
  bg: "#060D1B",
  bgGrad: "linear-gradient(180deg, #060D1B 0%, #0A1628 50%, #060E1C 100%)",
  card: "#0F1D30",
  surface: "#142236",
  green: "#3ECF75",
  greenDim: "rgba(62,207,117,0.12)",
  orange: "#FF9030",
  orangeDim: "rgba(255,144,48,0.12)",
  blue: "#4A9FF5",
  blueDim: "rgba(74,159,245,0.12)",
  purple: "#9B7FD4",
  purpleDim: "rgba(155,127,212,0.12)",
  red: "#FF4444",
  text: "#F0F8FF",
  textMuted: "#7A9BB5",
  textDim: "#4A6580",
  border: "rgba(255,255,255,0.07)",
};

const hikes = [
  { id: "1", name: "Musbury Tor Loop", date: "2026-06-07", distance: 8.4, elevationGain: 312, timeTaken: 142, notes: "Breezy at the top, views were incredible." },
  { id: "2", name: "Pendle Hill Summit", date: "2026-06-04", distance: 6.1, elevationGain: 248, timeTaken: 104 },
  { id: "3", name: "Ingleborough via Horton", date: "2026-05-29", distance: 14.2, elevationGain: 520, timeTaken: 210, notes: "Long but worth every step." },
];

function HikeRow({ hike }: { hike: typeof hikes[0] }) {
  const d = new Date(hike.date);
  const dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div style={{
      background: T.card, borderRadius: 14, border: `1px solid ${T.border}`,
      padding: 14, display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: T.greenDim,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Map size={14} color={T.green} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{hike.name}</span>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>{dateStr}</span>
          <span style={{ fontSize: 12, color: T.textDim }}>·</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{hike.distance}km</span>
          <span style={{ fontSize: 12, color: T.textDim }}>·</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{hike.elevationGain}m gain</span>
          <span style={{ fontSize: 12, color: T.textDim }}>·</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{hike.timeTaken}min</span>
        </div>
        {hike.notes && (
          <span style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>{hike.notes}</span>
        )}
      </div>
      <button style={{
        background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0,
      }}>
        <Trash2 size={14} color={T.red} />
      </button>
    </div>
  );
}

interface CategoryCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  colorDim: string;
  badge?: number;
}

function CategoryCard({ emoji, title, subtitle, color, colorDim, badge }: CategoryCardProps) {
  return (
    <div style={{
      background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
      padding: 14, display: "flex", alignItems: "center", gap: 10,
      minHeight: 72, position: "relative", overflow: "hidden", flex: 1,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, ${color}14 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        width: 38, height: 38, borderRadius: 12, background: `${color}22`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <span style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {badge != null && badge > 0 ? `${badge} ${subtitle}` : subtitle}
        </span>
      </div>
      {badge != null && badge > 0 && (
        <div style={{
          background: `${color}22`, borderRadius: 10, padding: "3px 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{badge}</span>
        </div>
      )}
      <ChevronRight size={15} color={T.textDim} />
    </div>
  );
}

export function SavedHikes() {
  return (
    <div style={{
      width: 390, minHeight: 844, background: T.bgGrad,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column", overflowY: "auto",
    }}>
      <div style={{ padding: "56px 20px 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, color: T.text, display: "flex",
          }}>
            <ArrowLeft size={20} color={T.text} />
          </button>
          <span style={{ fontSize: 26, fontWeight: 700, color: T.text, flex: 1 }}>Saved Hikes</span>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            background: T.greenDim, borderRadius: 12, border: `1px solid ${T.green}40`,
            padding: "9px 14px", cursor: "pointer",
          }}>
            <Plus size={15} color={T.green} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Log session</span>
          </button>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", background: T.card, borderRadius: 16,
          border: `1px solid ${T.border}`, padding: 14, justifyContent: "space-around",
        }}>
          {[
            { val: 3, label: "Saved", color: T.blue },
            { val: 7, label: "Completed", color: T.green },
            { val: 1, label: "Custom routes", color: T.purple },
            { val: hikes.length, label: "Sessions logged", color: T.orange },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</span>
              <span style={{ fontSize: 10, color: T.textMuted }}>{s.label}</span>
              {i < arr.length - 1 && (
                <div style={{
                  position: "absolute", width: 1, height: 28, background: T.border,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Category grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <CategoryCard emoji="🗺️" title="Nearby Trails" subtitle="Browse trails" color={T.blue} colorDim={T.blueDim} />
            <CategoryCard emoji="⛰️" title="Training Hills" subtitle="AI-powered hill lookup" color={T.orange} colorDim={T.orangeDim} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <CategoryCard emoji="🔖" title="Saved Routes" subtitle="trails you've bookmarked" color={T.blue} colorDim={T.blueDim} badge={3} />
            <CategoryCard emoji="✅" title="Completed" subtitle="trails you've finished" color={T.green} colorDim={T.greenDim} badge={7} />
          </div>
          {/* Full-width create card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
            padding: 14, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(90deg, ${T.purple}14 0%, transparent 60%)`,
              pointerEvents: "none",
            }} />
            <div style={{
              width: 42, height: 42, borderRadius: 12, background: `${T.purple}22`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Pencil size={18} color={T.purple} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Create My Own Route</span>
              <span style={{ fontSize: 12, color: T.textMuted }}>1 custom route saved</span>
            </div>
            <ChevronRight size={16} color={T.textDim} />
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Recent activity</span>
          <button style={{
            display: "flex", alignItems: "center", gap: 4,
            background: T.greenDim, borderRadius: 10, padding: "6px 10px",
            border: `1px solid ${T.green}30`, cursor: "pointer",
          }}>
            <Plus size={13} color={T.green} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Log</span>
          </button>
        </div>

        {/* Hike rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hikes.map(h => <HikeRow key={h.id} hike={h} />)}
        </div>

      </div>
    </div>
  );
}
