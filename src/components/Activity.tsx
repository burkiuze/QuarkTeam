import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileEdit,
  FileText,
  FolderTree,
  ListChecks,
  MessageSquare,
  Search,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";
import type { AgentEvent } from "../types";

function iconFor(event: AgentEvent) {
  if (event.type === "note") return <MessageSquare size={13} />;
  if (event.type === "warning") return <AlertTriangle size={13} />;
  if (event.type === "plan") return <ListChecks size={13} />;
  if (event.type === "done") return <CheckCircle2 size={13} />;
  if (event.type === "phase") {
    if (event.label.startsWith("Consulting")) return <Users size={13} />;
    return <Sparkles size={13} />;
  }

  const label = event.label.toLowerCase();
  if (label.startsWith("read")) return <FileText size={13} />;
  if (label.startsWith("writ") || label.startsWith("edit")) return <FileEdit size={13} />;
  if (label.startsWith("search")) return <Search size={13} />;
  if (label.startsWith("listing")) return <FolderTree size={13} />;
  if (label.startsWith("running") || label.startsWith("inspect") || label.startsWith("checking")) {
    return <Terminal size={13} />;
  }
  return <Sparkles size={13} />;
}

function elapsed(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  // A local model or a cached run can finish in well under a second; rounding
  // that to "0s" would read as broken rather than fast.
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return minutes ? `${minutes}m ${total % 60}s` : `${total}s`;
}

/**
 * The live work log. Every line is a real event from the run — a tool the
 * executor called, a phase it entered, or prose it wrote about what it is
 * doing — so this shows what happened rather than a narration of it.
 */
export function Activity({
  events,
  running,
  startedAt,
  finishedAt,
}: {
  events: AgentEvent[];
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    // Collapse to a one-line summary once the crew is done.
    if (!running && finishedAt) setOpen(false);
    if (running) setOpen(true);
  }, [running, finishedAt]);

  // "result" repeats the tool line that produced it and "plan" has its own
  // block below, so the log keeps only what adds something.
  const steps = events.filter(
    (event) => event.type !== "result" && event.type !== "plan" && event.type !== "done",
  );

  if (!steps.length && !running) return null;

  // Timing comes from the events themselves, so the header always describes
  // the work that is actually on screen; the session timestamps are fallbacks.
  const first = events[0]?.ts ?? startedAt;
  const last = running ? now : (events[events.length - 1]?.ts ?? finishedAt ?? now);
  const duration = first ? Math.max(0, last - first) : 0;
  const shown = open ? steps.slice(-40) : [];

  return (
    <div className="activity">
      <button className="activity-head" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={running ? "pulsing" : ""}>
          {running ? "Working" : "Worked"} for {elapsed(duration)}
        </span>
        <span className="activity-count">{steps.length} steps</span>
      </button>

      {open ? (
        <div className="activity-list">
          {shown.map((event, index) => (
            <div className={`activity-row ${event.type}`} key={`${event.ts}-${index}`}>
              <span className="activity-icon">{iconFor(event)}</span>
              <div className="activity-text">
                <span className="activity-label">{event.label}</span>
                {event.detail && event.type !== "note" ? (
                  <span className="activity-detail">{event.detail.split("\n")[0].slice(0, 140)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
