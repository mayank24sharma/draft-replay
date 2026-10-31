import {
  getPendingSnapshots,
  removePendingSnapshot,
  getWriteKey,
  saveLocalSnapshot,
  getLocalSnapshots,
  saveLocalDoc,
  getLocalDoc,
} from './db';
import { Snapshot } from '../types';

type SyncListener = (status: { pendingCount: number; isOnline: boolean; isSyncing: boolean }) => void;
const listeners = new Set<SyncListener>();

let isSyncing = false;
let retryBackoffMs = 1000;

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(pendingCount: number) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  for (const listener of listeners) {
    listener({ pendingCount, isOnline, isSyncing });
  }
}

export async function drainPendingQueue(docId: string): Promise<void> {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = await getPendingSnapshots(docId);
    notifyListeners(pending.length);
    return;
  }

  isSyncing = true;
  try {
    const writeKey = await getWriteKey(docId);
    if (!writeKey) {
      const pending = await getPendingSnapshots(docId);
      notifyListeners(pending.length);
      return;
    }

    const pending = await getPendingSnapshots(docId);
    notifyListeners(pending.length);

    for (const item of pending) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      try {
        const res = await fetch(`/api/docs/${docId}/snapshots`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${writeKey}`,
          },
          body: JSON.stringify({
            snapshotId: item.snapshotId,
            clientT: item.clientT,
            text: item.text,
            eventType: item.eventType,
            inserted: item.inserted,
            deleted: item.deleted,
            countSource: item.countSource,
          }),
        });

        if (res.status === 200) {
          const data = await res.json();
          // Successfully stored on server! Update local snapshot with authoritative seq & t
          const syncedSnap: Snapshot = {
            docId,
            snapshotId: item.snapshotId,
            seq: data.seq,
            t: data.t,
            clientT: item.clientT,
            text: item.text,
            eventType: item.eventType,
            inserted: item.inserted,
            deleted: item.deleted,
            countSource: item.countSource,
          };
          await saveLocalSnapshot(syncedSnap);
          await removePendingSnapshot(item.snapshotId);

          const docMeta = await getLocalDoc(docId);
          if (docMeta) {
            docMeta.lastSeq = Math.max(docMeta.lastSeq, data.seq);
            await saveLocalDoc(docMeta);
          }

          retryBackoffMs = 1000;
        } else if (res.status === 429) {
          // Rate limit: back off
          const retryAfterSec = parseInt(res.headers.get('Retry-After') || '2', 10);
          await new Promise((r) => setTimeout(r, Math.max(retryAfterSec * 1000, 2000)));
          break;
        } else if (res.status === 401 || res.status === 403) {
          // Authentication error: keep in pending queue, stop hammering
          console.warn('[Sync] Auth error while appending snapshot:', res.status);
          break;
        } else {
          // Server error or payload error
          await new Promise((r) => setTimeout(r, retryBackoffMs));
          retryBackoffMs = Math.min(retryBackoffMs * 2, 10000);
          break;
        }
      } catch (err) {
        // Network failure
        break;
      }
    }
  } finally {
    isSyncing = false;
    const remaining = await getPendingSnapshots(docId);
    notifyListeners(remaining.length);
  }
}

// Window listeners for online events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Notify listeners and let active views drain their queues
    notifyListeners(0);
  });
  window.addEventListener('offline', () => {
    notifyListeners(0);
  });
}
