import { EventType, CountSource, Snapshot } from '../types';
import { generateUUID } from './crypto';
import { enqueuePendingSnapshot, saveLocalSnapshot } from './db';
import { drainPendingQueue } from './sync';

export interface DiffResult {
  p: number;
  s: number;
  inserted: number;
  deleted: number;
}

export function computePrefixSuffixDiff(before: string, after: string): DiffResult {
  const minLen = Math.min(before.length, after.length);
  let p = 0;
  while (p < minLen && before[p] === after[p]) {
    p++;
  }

  let s = 0;
  while (s < minLen - p && before[before.length - 1 - s] === after[after.length - 1 - s]) {
    s++;
  }

  const inserted = after.length - p - s;
  const deleted = before.length - p - s;
  return { p, s, inserted, deleted };
}

export interface CaptureCallbacks {
  onSnapshotSaved: (snap: Snapshot) => void;
  onPasteToast: () => void;
  onStatsUpdate: (stats: { totalPastes: number; totalDeletions: number; snapshotCount: number }) => void;
}

export class CaptureEngine {
  private docId: string;
  private lastInputText: string = '';
  private lastSnapshotText: string = '';
  private pauseTimer: any = null;
  private pendingClipboardLength: number | null = null;
  private callbacks: CaptureCallbacks;

  // Monospace ticker counters
  public totalPastes: number = 0;
  public totalDeletions: number = 0;
  public snapshotCount: number = 0;

  constructor(docId: string, initialText: string, callbacks: CaptureCallbacks) {
    this.docId = docId;
    this.lastInputText = initialText;
    this.lastSnapshotText = initialText;
    this.callbacks = callbacks;
  }

  public reset(docId: string, initialText: string, initialSnapshotCount: number = 0, initialPastes: number = 0, initialDeletions: number = 0) {
    this.clearPauseTimer();
    this.docId = docId;
    this.lastInputText = initialText;
    this.lastSnapshotText = initialText;
    this.snapshotCount = initialSnapshotCount;
    this.totalPastes = initialPastes;
    this.totalDeletions = initialDeletions;
    this.pendingClipboardLength = null;
    this.callbacks.onStatsUpdate({
      totalPastes: this.totalPastes,
      totalDeletions: this.totalDeletions,
      snapshotCount: this.snapshotCount,
    });
  }

  private clearPauseTimer() {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  // Intercept paste event directly to record accurate clipboard UTF-16 code units length
  public handlePasteEvent(e: React.ClipboardEvent | ClipboardEvent) {
    try {
      const clipText = e.clipboardData?.getData('text/plain');
      if (clipText && clipText.length > 0) {
        this.pendingClipboardLength = clipText.length;
      }
    } catch (_) {}
  }

  // Main input handler per spec
  public handleInput(
    currentText: string,
    inputType?: string
  ) {
    const before = this.lastInputText;
    const after = currentText;
    const diff = computePrefixSuffixDiff(before, after);
    this.lastInputText = after;

    const normalizedInputType = inputType || '';

    // 2. Paste path (event-first)
    const isPaste = normalizedInputType.startsWith('insertFromPaste') || this.pendingClipboardLength !== null;
    if (isPaste) {
      this.clearPauseTimer();
      const exactInserted = this.pendingClipboardLength !== null ? this.pendingClipboardLength : diff.inserted;
      const countSource: CountSource = this.pendingClipboardLength !== null ? 'event' : 'diff-estimate';
      this.pendingClipboardLength = null;

      this.totalPastes += 1;
      this.callbacks.onPasteToast();
      this.saveSnapshot(after, 'paste', exactInserted, diff.deleted, countSource);
      return;
    }

    // 3. Undo path: inputType "historyUndo"/"historyRedo" -> eventType "undo". Snapshot IMMEDIATELY.
    if (normalizedInputType === 'historyUndo' || normalizedInputType === 'historyRedo') {
      this.clearPauseTimer();
      this.saveSnapshot(after, 'undo', diff.inserted, diff.deleted, 'diff-estimate');
      return;
    }

    // 4. Large delete / replace path: deleted > 40 -> eventType "large_delete". Snapshot IMMEDIATELY.
    if (diff.deleted > 40) {
      this.clearPauseTimer();
      this.totalDeletions += diff.deleted;
      this.saveSnapshot(after, 'large_delete', diff.inserted, diff.deleted, 'diff-estimate');
      return;
    }

    // 5. insertFromDrop (drag-and-drop): recorded as TYPING (diff-estimate). No block card.
    // 6. Otherwise -> "typing": no immediate snapshot; starts/refreshes the 2 s pause timer.
    if (diff.deleted > 0) {
      this.totalDeletions += diff.deleted;
      this.callbacks.onStatsUpdate({
        totalPastes: this.totalPastes,
        totalDeletions: this.totalDeletions,
        snapshotCount: this.snapshotCount,
      });
    }

    // Refresh 2-second pause timer
    this.clearPauseTimer();
    this.pauseTimer = setTimeout(() => {
      this.saveSnapshot(this.lastInputText, 'pause', 0, 0, 'diff-estimate');
    }, 2000);
  }

  // Force flush snapshot immediately (e.g. before navigating to Replay or Finish & Declare)
  public flushPendingPause(currentText: string) {
    this.clearPauseTimer();
    if (currentText !== this.lastSnapshotText) {
      this.saveSnapshot(currentText, 'pause', 0, 0, 'diff-estimate');
    }
  }

  private async saveSnapshot(
    text: string,
    eventType: EventType,
    inserted: number,
    deleted: number,
    countSource: CountSource
  ) {
    // DEDUPE (D2): before saving ANY snapshot, if text === lastSnapshotText -> skip and drop.
    if (text === this.lastSnapshotText) {
      return;
    }

    this.lastSnapshotText = text;
    this.snapshotCount += 1;

    this.callbacks.onStatsUpdate({
      totalPastes: this.totalPastes,
      totalDeletions: this.totalDeletions,
      snapshotCount: this.snapshotCount,
    });

    const clientT = Date.now();
    const snapshotId = generateUUID();

    // Optimistic local snapshot with temporary client sequence
    const snapshot: Snapshot = {
      docId: this.docId,
      snapshotId,
      seq: this.snapshotCount,
      t: clientT,
      clientT,
      text,
      eventType,
      inserted,
      deleted,
      countSource,
    };

    // Save locally first (offline required)
    await saveLocalSnapshot(snapshot);
    await enqueuePendingSnapshot({
      docId: this.docId,
      snapshotId,
      clientT,
      text,
      eventType,
      inserted,
      deleted,
      countSource,
    });

    this.callbacks.onSnapshotSaved(snapshot);

    // Trigger sync drain in background
    drainPendingQueue(this.docId).catch(() => {});
  }
}
