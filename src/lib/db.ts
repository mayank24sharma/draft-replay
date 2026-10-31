import { Snapshot, DocumentMeta } from '../types';

const DB_NAME = 'draftreplay_idb';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'docId' });
      }

      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'docId' });
      }

      if (!db.objectStoreNames.contains('localSnapshots')) {
        const store = db.createObjectStore('localSnapshots', { keyPath: 'id' });
        store.createIndex('docId', 'docId', { unique: false });
        store.createIndex('docId_seq', ['docId', 'seq'], { unique: true });
      }

      if (!db.objectStoreNames.contains('pendingSnapshots')) {
        const pStore = db.createObjectStore('pendingSnapshots', { keyPath: 'snapshotId' });
        pStore.createIndex('docId', 'docId', { unique: false });
        pStore.createIndex('clientT', 'clientT', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// ---------------- Keys ----------------
export async function saveWriteKey(docId: string, writeKey: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').put({ docId, writeKey, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWriteKey(docId: string): Promise<string | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const req = tx.objectStore('keys').get(docId);
    req.onsuccess = () => resolve(req.result ? req.result.writeKey : null);
    req.onerror = () => reject(tx.error);
  });
}

export async function deleteWriteKey(docId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').delete(docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- Documents ----------------
export async function saveLocalDoc(doc: DocumentMeta): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalDoc(docId: string): Promise<DocumentMeta | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const req = tx.objectStore('documents').get(docId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(tx.error);
  });
}

export async function getAllLocalDocs(): Promise<DocumentMeta[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const req = tx.objectStore('documents').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(tx.error);
  });
}

// ---------------- Local Snapshots ----------------
export async function saveLocalSnapshot(snap: Snapshot): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('localSnapshots', 'readwrite');
    tx.objectStore('localSnapshots').put({
      id: `${snap.docId}_${snap.snapshotId}`,
      ...snap,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalSnapshots(docId: string): Promise<Snapshot[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('localSnapshots', 'readonly');
    const store = tx.objectStore('localSnapshots');
    const index = store.index('docId');
    const req = index.getAll(docId);
    req.onsuccess = () => {
      const items = (req.result || []) as Snapshot[];
      items.sort((a, b) => a.seq - b.seq || a.clientT - b.clientT);
      resolve(items);
    };
    req.onerror = () => reject(tx.error);
  });
}

// ---------------- Pending Snapshots (Queue) ----------------
export interface PendingSnapshotItem {
  docId: string;
  snapshotId: string;
  clientT: number;
  text: string;
  eventType: 'paste' | 'large_delete' | 'undo' | 'pause';
  inserted: number;
  deleted: number;
  countSource: 'event' | 'diff-estimate';
  retryCount?: number;
}

export async function enqueuePendingSnapshot(item: PendingSnapshotItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSnapshots', 'readwrite');
    tx.objectStore('pendingSnapshots').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSnapshots(docId: string): Promise<PendingSnapshotItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSnapshots', 'readonly');
    const store = tx.objectStore('pendingSnapshots');
    const index = store.index('docId');
    const req = index.getAll(docId);
    req.onsuccess = () => {
      const items = (req.result || []) as PendingSnapshotItem[];
      items.sort((a, b) => a.clientT - b.clientT);
      resolve(items);
    };
    req.onerror = () => reject(tx.error);
  });
}

export async function removePendingSnapshot(snapshotId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingSnapshots', 'readwrite');
    tx.objectStore('pendingSnapshots').delete(snapshotId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------- Cache Size Estimation (Rule 7) ----------------
// Near ~4 MB -> visible warning
export async function estimateCacheUsageBytes(): Promise<number> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return est.usage || 0;
    }
  } catch (e) {}

  // Fallback estimation by sampling snapshot texts
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('localSnapshots', 'readonly');
      const req = tx.objectStore('localSnapshots').getAll();
      req.onsuccess = () => {
        let bytes = 0;
        for (const snap of req.result || []) {
          bytes += (snap.text?.length || 0) * 2 + 128;
        }
        resolve(bytes);
      };
      req.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

// ---------------- Site Data Reset (T21b) ----------------
export async function clearAllLocalData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['keys', 'documents', 'localSnapshots', 'pendingSnapshots'], 'readwrite');
    tx.objectStore('keys').clear();
    tx.objectStore('documents').clear();
    tx.objectStore('localSnapshots').clear();
    tx.objectStore('pendingSnapshots').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
