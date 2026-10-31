// Time utilities adhering strictly to TIME SPAN DISPLAY specifications:
// - Viewer local timezone, 12-hour with AM/PM.
// - Date beside time if date differs from today (e.g. "First save 31 Oct, 11:00 AM").
// - Two-line format:
//   Line 1: "Saved states span 2 h 00 m (12 saves)" (or "1 saved state — no span yet", or "No saved states yet")
//   Line 2: "First save 11:00 AM · Last save 1:00 PM"
// - Caveat directly below:
//   "Measured from saved states on the student's device clock, not from activity. Time away, thinking, and reading a reference all look the same. This is an indicator, not proof."

export function formatTimeSpanDuration(spanMs: number): string {
  if (spanMs <= 0) return '0 m';
  const totalMinutes = Math.round(spanMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, '0')} m`;
  }
  return `${minutes} m`;
}

export function formatSaveTimestamp(ms: number): string {
  if (!ms || isNaN(ms)) return '--:--';
  const d = new Date(ms);
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  // 12-hour clock with AM/PM
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return timeStr;
  }

  // If different date: e.g. "31 Oct, 11:00 AM"
  const dateStr = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
}

export interface SpanDisplayData {
  line1: string;
  line2: string | null;
  caveat: string;
}

export function computeSpanDisplay(
  snapshotCount: number,
  startMs: number,
  endMs: number,
  spanMs?: number
): SpanDisplayData {
  const caveat =
    "Measured from saved states on the student's device clock, not from activity. Time away, thinking, and reading a reference all look the same. This is an indicator, not proof.";

  if (snapshotCount === 0) {
    return {
      line1: 'No saved states yet',
      line2: null,
      caveat,
    };
  }

  if (snapshotCount === 1) {
    return {
      line1: '1 saved state — no span yet',
      line2: `Save: ${formatSaveTimestamp(startMs)}`,
      caveat,
    };
  }

  const duration = spanMs !== undefined && spanMs >= 0 ? spanMs : Math.max(0, endMs - startMs);
  const durationText = formatTimeSpanDuration(duration);

  return {
    line1: `Saved states span ${durationText} (${snapshotCount} saves)`,
    line2: `First save ${formatSaveTimestamp(startMs)} · Last save ${formatSaveTimestamp(endMs)}`,
    caveat,
  };
}
