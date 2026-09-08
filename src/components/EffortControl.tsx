import { useEffect, useRef, useState } from "react";
import type { Effort } from "../types";

/**
 * Effort is not decoration: each level changes how many turns the executor
 * gets, how many advisers run before it and how hard the patch is reviewed
 * afterwards. The colour ramp makes the cost of the choice visible.
 */
export const EFFORT_LEVELS: Array<{
  id: Effort;
  label: string;
  colour: string;
  summary: string;
}> = [
  {
    id: "auto",
    label: "Auto",
    colour: "#7b8794",
    summary: "sizes itself to the request",
  },
  {
    id: "economic",
    label: "Economic",
    colour: "#5aa469",
    summary: "16 turns · no advisers · no review",
  },
  { id: "medium", label: "Medium", colour: "#4f8fd0", summary: "28 turns · one reviewer" },
  { id: "high", label: "High", colour: "#5b6bdc", summary: "40 turns · 2 advisers · one reviewer" },
  { id: "extra", label: "Extra", colour: "#8a5bd6", summary: "56 turns · advisers + planner" },
  { id: "max", label: "Max", colour: "#c2683f", summary: "80 turns · 4 advisers + planner" },
  {
    id: "ultracode",
    label: "Ultracode",
    colour: "#cf4b4b",
    summary: "120 turns · 4 advisers · two independent reviewers",
  },
];

export function effortColour(effort: Effort) {
  return EFFORT_LEVELS.find((level) => level.id === effort)?.colour ?? "#5b6bdc";
}

/** Speedometer arc: filled proportionally to the chosen level. */
function Gauge({ ratio, colour }: { ratio: number; colour: string }) {
  const radius = 7.5;
  const sweep = Math.PI * 1.5;
  const start = Math.PI * 0.75;
  const length = radius * sweep;

  const point = (angle: number) => [10 + radius * Math.cos(angle), 10 + radius * Math.sin(angle)];
  const [sx, sy] = point(start);
  const [ex, ey] = point(start + sweep);
  const needle = point(start + sweep * ratio);

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d={`M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`}
        fill="none"
        stroke="#3a3a44"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`}
        fill="none"
        stroke={colour}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${length * Math.max(ratio, 0.02)} ${length}`}
      />
      <line
        x1="10"
        y1="10"
        x2={needle[0]}
        y2={needle[1]}
        stroke="#f1f1f4"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.6" fill="#f1f1f4" />
    </svg>
  );
}

export function EffortControl({
  value,
  onChange,
  disabled,
}: {
  value: Effort;
  onChange: (effort: Effort) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const index = Math.max(
    0,
    EFFORT_LEVELS.findIndex((level) => level.id === value),
  );
  const level = EFFORT_LEVELS[index];
  const ratio = index / (EFFORT_LEVELS.length - 1);

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 232)),
        bottom: Math.max(12, window.innerHeight - rect.top + 8),
      });
    };
    place();

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="effort" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`effort-button ${open ? "open" : ""}`}
        style={{ ["--effort" as string]: level.colour }}
        disabled={disabled}
        title={`${level.label} effort — ${level.summary}`}
        aria-label={`Effort: ${level.label}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Gauge ratio={ratio} colour={level.colour} />
      </button>

      {open ? (
        <div
          className="effort-menu"
          style={anchor ? { left: anchor.left, bottom: anchor.bottom } : { visibility: "hidden" }}
        >
          <div className="effort-menu-head">Effort</div>
          {EFFORT_LEVELS.map((item, position) => (
            <button
              key={item.id}
              type="button"
              className={`effort-option ${item.id === value ? "selected" : ""}`}
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
            >
              <span className="effort-dot" style={{ background: item.colour }} />
              <span className="effort-option-body">
                <span className="effort-option-label">{item.label}</span>
                <span className="effort-option-summary">{item.summary}</span>
              </span>
              <span className="effort-option-rank">{position + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
