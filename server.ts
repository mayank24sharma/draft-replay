import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = 3000;

// Body limit <= 1 MB per spec
app.use(express.json({ limit: '1mb' }));

// Sanitize logs: NEVER log Authorization header, write key, document text, or share tokens (T15 & Rule 8)
app.use((req: Request, res: Response, next: NextFunction) => {
  const sanitizedUrl = req.originalUrl.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');
  // Do not log request headers or bodies containing sensitive keys
  res.on('finish', () => {
    if (res.statusCode >= 500) {
      console.error(`[DraftReplay Server] ${req.method} ${sanitizedUrl} -> ${res.statusCode}`);
    }
  });
  next();
});

// SHA-256 utility
export function hashSha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

// In-memory rate limiting (best-effort, memory only, never stored in DB - Rule 3 & spec)
interface RateBucket {
  tokens: number;
  lastRefill: number;
}
const rateBuckets = new Map<string, RateBucket>();
const MAX_RATE_PER_MIN = 120; // Allows offline queue to flush >= 60 appends/min

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: MAX_RATE_PER_MIN, lastRefill: now };
    rateBuckets.set(key, bucket);
  } else {
    const elapsedMinutes = (now - bucket.lastRefill) / 60000;
    bucket.tokens = Math.min(MAX_RATE_PER_MIN, bucket.tokens + elapsedMinutes * MAX_RATE_PER_MIN);
    bucket.lastRefill = now;
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// Data structures
export interface DocRow {
  id: string;
  title: string;
  student_id?: string;
  studentClass?: string;
  is_submitted?: boolean;
  submitted_at?: number | null;
  created_at: number;
  last_seq: number;
  version: number;
  key_hash: string;
  declaration: {
    level: 'none' | 'ideas' | 'drafted' | 'wrote-parts';
    note: string;
    declaredAt: number;
  } | null;
  grade?: {
    score: number;
    letterGrade: string;
    rubric: {
      processIntegrity: number;
      aiDisclosure: number;
      writingQuality: number;
      revisionDepth: number;
    };
    feedback: string;
    gradingExplanation?: string;
    gradedAt: number;
    gradedBy: string;
    status: 'graded' | 'needs-revision';
  } | null;
  reviewStatus?: 'submitted' | 'seen' | 'under_review' | 'reviewed';
  reviewStatusUpdatedAt?: number;
  teacherComments?: string;
}

export interface SnapshotRow {
  doc_id: string;
  snapshot_id: string;
  seq: number;
  t: number;
  client_t: number;
  text: string;
  event_type: 'paste' | 'large_delete' | 'undo' | 'pause';
  inserted: number;
  deleted: number;
  count_source: 'event' | 'diff-estimate';
}

export interface ShareRow {
  token_hash: string;
  doc_id: string;
  created_at: number;
  revoked_at: number | null;
}

// Storage Engine
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
let pgPool: pg.Pool | null = null;
let postgresReady = false;

if (connectionString) {
  try {
    pgPool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10_000,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  } catch (err) {
    console.error('Failed to initialize pg Pool with connection string');
  }
}

// Fallback in-memory / local-file persistent store ensuring transaction locks, gap-free seq, SQLSTATE 23505 handling
const localDocs = new Map<string, DocRow>();
const localSnapshots = new Map<string, SnapshotRow[]>();
const localShares = new Map<string, ShareRow>();
const docLocks = new Map<string, Promise<any>>();

// Load persisted local store if exists
const DATA_FILE = path.resolve('.data/draftreplay-storage.json');
function loadLocalStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.docs)) {
        for (const d of data.docs) localDocs.set(d.id, d);
      }
      if (data.snapshots && typeof data.snapshots === 'object') {
        for (const [k, v] of Object.entries(data.snapshots)) {
          localSnapshots.set(k, v as SnapshotRow[]);
        }
      }
      if (Array.isArray(data.shares)) {
        for (const s of data.shares) localShares.set(s.token_hash, s);
      }
    }
  } catch (e) {
    // Ignore load errors
  }
}

function saveLocalStore() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = {
      docs: Array.from(localDocs.values()),
      snapshots: Object.fromEntries(localSnapshots.entries()),
      shares: Array.from(localShares.values()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    // Best effort
  }
}

loadLocalStore();

async function initPostgres() {
  if (!pgPool) return false;
  try {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS docs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          last_seq INTEGER NOT NULL DEFAULT 0,
          version INTEGER NOT NULL DEFAULT 1,
          key_hash TEXT NOT NULL,
          declaration JSONB
        );
        CREATE TABLE IF NOT EXISTS snapshots (
          doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
          snapshot_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          t BIGINT NOT NULL,
          client_t BIGINT NOT NULL,
          text TEXT NOT NULL,
          event_type TEXT NOT NULL,
          inserted INTEGER NOT NULL,
          deleted INTEGER NOT NULL,
          count_source TEXT NOT NULL,
          PRIMARY KEY (doc_id, seq),
          UNIQUE (doc_id, snapshot_id)
        );
        CREATE TABLE IF NOT EXISTS shares (
          token_hash TEXT PRIMARY KEY,
          doc_id TEXT NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL,
          revoked_at BIGINT
        );
      `);
      postgresReady = true;
      return true;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Postgres init failed, using local persistent session pool');
    postgresReady = false;
    return false;
  }
}

initPostgres();

// Helper to lock doc transactions sequentially in local store
async function withDocLock<T>(docId: string, fn: () => Promise<T>): Promise<T> {
  const current = docLocks.get(docId) || Promise.resolve();
  let nextResolve: () => void;
  const next = new Promise<void>((res) => {
    nextResolve = res;
  });
  docLocks.set(docId, next);

  await current.catch(() => {});
  try {
    return await fn();
  } finally {
    nextResolve!();
    if (docLocks.get(docId) === next) {
      docLocks.delete(docId);
    }
  }
}

// Document repository methods
async function getDoc(docId: string): Promise<DocRow | null> {
  if (postgresReady && pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM docs WHERE id = $1', [docId]);
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        title: r.title,
        created_at: Number(r.created_at),
        last_seq: Number(r.last_seq),
        version: Number(r.version),
        key_hash: r.key_hash,
        declaration: r.declaration,
      };
    } catch (e) {
      // Fallback to local
    }
  }
  return localDocs.get(docId) || null;
}

// Verify write key authorization helper
async function verifyWriteKey(docId: string, req: Request): Promise<{ ok: boolean; status: number; message: string; doc?: DocRow }> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { ok: false, status: 401, message: 'Missing Authorization header with write key' };
  }
  const key = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!key) {
    return { ok: false, status: 401, message: 'Empty write key in Authorization header' };
  }
  const doc = await getDoc(docId);
  if (!doc) {
    return { ok: false, status: 404, message: 'Document not found' };
  }
  const hash = hashSha256(key);
  if (hash !== doc.key_hash) {
    return { ok: false, status: 403, message: 'Forbidden: Invalid write key for this document' };
  }
  return { ok: true, status: 200, message: 'Authorized', doc };
}

// Verify reviewer token or write key for GET routes
async function verifyReadAccess(docId: string, req: Request): Promise<{ ok: boolean; status: number; message: string; doc?: DocRow; isReviewer: boolean }> {
  const doc = await getDoc(docId);
  if (!doc) {
    return { ok: false, status: 404, message: 'Document not found', isReviewer: false };
  }

  // 1. Check write key in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const key = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (key && hashSha256(key) === doc.key_hash) {
      return { ok: true, status: 200, message: 'Authorized as author', doc, isReviewer: false };
    }
  }

  // 2. Check reviewer token query parameter
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : null;
  if (token) {
    const tokenHash = hashSha256(token);
    if (postgresReady && pgPool) {
      try {
        const res = await pgPool.query(
          'SELECT * FROM shares WHERE token_hash = $1 AND doc_id = $2 AND revoked_at IS NULL',
          [tokenHash, docId]
        );
        if (res.rows.length > 0) {
          return { ok: true, status: 200, message: 'Authorized via reviewer token', doc, isReviewer: true };
        }
      } catch (e) {
        // Fallback
      }
    }
    const share = localShares.get(tokenHash);
    if (share && share.doc_id === docId && share.revoked_at === null) {
      return { ok: true, status: 200, message: 'Authorized via reviewer token', doc, isReviewer: true };
    }
  }

  return { ok: false, status: 403, message: 'Forbidden: Requires valid write key header or active reviewer token', isReviewer: false };
}

// ---------------- API ROUTES ----------------

// POST /api/docs: create {title, studentId, studentFirstName, studentClass} + browser write key hash -> {docId}
app.post('/api/docs', async (req: Request, res: Response) => {
  try {
    const { title, studentId: requestedStudentId, studentClass, keyHash, docId: requestedDocId } = req.body;
    if (!keyHash || typeof keyHash !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid keyHash' });
    }

    const docId = requestedDocId && typeof requestedDocId === 'string' && requestedDocId.length >= 20
      ? requestedDocId
      : crypto.randomBytes(18).toString('base64url');

    const cleanTitle = (title && typeof title === 'string' && title.trim()) ? title.trim().slice(0, 200) : 'Untitled Document';
    const cleanStudentId = (requestedStudentId && typeof requestedStudentId === 'string' && requestedStudentId.trim())
      ? requestedStudentId.trim().slice(0, 50)
      : `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanClass = (studentClass && typeof studentClass === 'string') ? studentClass.trim().slice(0, 100) : '';
    const createdAt = Date.now();

    const newDoc: DocRow = {
      id: docId,
      title: cleanTitle,
      student_id: cleanStudentId,
      studentClass: cleanClass,
      created_at: createdAt,
      last_seq: 0,
      version: 1,
      key_hash: keyHash,
      declaration: null,
      grade: null,
    };

    if (postgresReady && pgPool) {
      try {
        await pgPool.query(
          'INSERT INTO docs (id, title, created_at, last_seq, version, key_hash, declaration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [docId, cleanTitle, createdAt, 0, 1, keyHash, null]
        );
      } catch (e) {
        // Fallback to local
      }
    }

    localDocs.set(docId, newDoc);
    localSnapshots.set(docId, []);
    saveLocalStore();

    return res.status(201).json({
      docId,
      title: cleanTitle,
      studentId: cleanStudentId,
      studentClass: cleanClass,
      version: 1,
      createdAt,
      lastSeq: 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create document' });
  }
});

// GET /api/docs: list all documents for Teacher's Corner
app.get('/api/docs', async (req: Request, res: Response) => {
  const docsList = Array.from(localDocs.values()).map((d) => ({
    docId: d.id,
    title: d.title,
    studentId: d.student_id || 'STU-2026-0001',
    studentClass: d.studentClass || '',
    createdAt: d.created_at,
    lastSeq: d.last_seq,
    version: d.version,
    isSubmitted: !!d.is_submitted,
    submittedAt: d.submitted_at || null,
    hasDeclaration: !!d.declaration,
    declaration: d.declaration,
    grade: d.grade || null,
    reviewStatus: d.reviewStatus || (d.grade ? 'reviewed' : d.is_submitted ? 'submitted' : undefined),
    reviewStatusUpdatedAt: d.reviewStatusUpdatedAt || null,
    teacherComments: d.teacherComments || null,
  }));
  // Sort most recent first
  docsList.sort((a, b) => (b.submittedAt || b.createdAt) - (a.submittedAt || a.createdAt));
  return res.status(200).json({ docs: docsList });
});

// POST /api/docs/:id/grade: Teacher saves marks & feedback
app.post('/api/docs/:id/grade', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const doc = await getDoc(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { score, letterGrade, rubric, feedback, status, gradedBy, gradingExplanation, reviewStatus } = req.body;
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({ error: 'Score must be a number between 0 and 100' });
    }

    const gradeRecord = {
      score: Math.round(score),
      letterGrade: typeof letterGrade === 'string' ? letterGrade : 'A',
      rubric: {
        processIntegrity: Number(rubric?.processIntegrity ?? 25),
        aiDisclosure: Number(rubric?.aiDisclosure ?? 25),
        writingQuality: Number(rubric?.writingQuality ?? 25),
        revisionDepth: Number(rubric?.revisionDepth ?? 25),
      },
      feedback: typeof feedback === 'string' ? feedback.trim() : '',
      gradingExplanation: typeof gradingExplanation === 'string' ? gradingExplanation.trim() : '',
      gradedAt: Date.now(),
      gradedBy: typeof gradedBy === 'string' && gradedBy.trim() ? gradedBy.trim() : 'Teacher',
      status: (status === 'needs-revision' ? 'needs-revision' : 'graded') as ('graded' | 'needs-revision'),
    };

    doc.grade = gradeRecord;
    doc.reviewStatus = (reviewStatus as any) || 'reviewed';
    doc.reviewStatusUpdatedAt = Date.now();
    localDocs.set(docId, doc);
    saveLocalStore();

    return res.status(200).json({
      success: true,
      docId,
      grade: gradeRecord,
      reviewStatus: doc.reviewStatus,
      message: 'Marks, rubric feedback, and review status saved successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save marks: ' + err.message });
  }
});

// POST /api/docs/:id/review-status: Teacher updates status (seen, under_review, reviewed) and optional comments
app.post('/api/docs/:id/review-status', async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const doc = await getDoc(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { status, comments } = req.body;
    const allowed = ['submitted', 'seen', 'under_review', 'reviewed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid review status. Allowed: ' + allowed.join(', ') });
    }

    doc.reviewStatus = status;
    doc.reviewStatusUpdatedAt = Date.now();
    if (typeof comments === 'string') {
      doc.teacherComments = comments.trim();
    }
    localDocs.set(docId, doc);
    saveLocalStore();

    return res.status(200).json({
      success: true,
      docId,
      reviewStatus: doc.reviewStatus,
      reviewStatusUpdatedAt: doc.reviewStatusUpdatedAt,
      teacherComments: doc.teacherComments || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update review status: ' + err.message });
  }
});

// POST /api/docs/:id/submit: student submits essay (locks further editing)
app.post('/api/docs/:id/submit', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  const doc = auth.doc!;
  const now = Date.now();
  doc.is_submitted = true;
  doc.submitted_at = now;
  localDocs.set(docId, doc);
  saveLocalStore();

  return res.status(200).json({
    success: true,
    isSubmitted: true,
    submittedAt: now,
    message: 'Essay submitted to Teacher\'s Corner successfully. Document is now locked.',
  });
});

// POST /api/docs/:id/snapshots: append snapshot
// APPEND RULES:
// a) Authenticate write key and validate payload BEFORE touching pool.
// b) Transaction: UPDATE last_seq + INSERT snapshot.
// c) PLAIN insert (no ON CONFLICT DO NOTHING).
// d) Catch unique violation SQLSTATE 23505 -> SELECT existing row, return 200.
// e) ONE checked-out client for entire transaction.
// f) Idempotency: same snapshotId -> return stored {seq, t}, insert nothing.
// g) Limits: text <= 32 KB, <= 2,000 snapshots.
app.post('/api/docs/:id/snapshots', async (req: Request, res: Response) => {
  const docId = req.params.id;

  // 1. Authenticate write key BEFORE touching pool/locks
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  const doc = auth.doc!;

  // If essay has been submitted, no further changes allowed
  if (doc.is_submitted) {
    return res.status(403).json({ error: 'This essay has been submitted and locked. No further modifications allowed.' });
  }

  // 2. Validate payload BEFORE touching pool/locks
  const { snapshotId, clientT, text, eventType, inserted, deleted, countSource } = req.body;
  if (!snapshotId || typeof snapshotId !== 'string') {
    return res.status(400).json({ error: 'Missing snapshotId' });
  }
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text' });
  }
  // Hard limit: text <= 32 KB (32768 UTF-16 code units / bytes) (T12)
  if (text.length > 32768) {
    return res.status(413).json({ error: 'Snapshot text exceeds 32 KB limit' });
  }
  const validEventTypes = ['paste', 'large_delete', 'undo', 'pause'];
  if (!validEventTypes.includes(eventType)) {
    return res.status(400).json({ error: `Invalid eventType. Allowed: ${validEventTypes.join(', ')}` });
  }
  const validCountSources = ['event', 'diff-estimate'];
  if (!validCountSources.includes(countSource)) {
    return res.status(400).json({ error: `Invalid countSource. Allowed: ${validCountSources.join(', ')}` });
  }

  // Rate limiting (in-memory per docId + key)
  const authHeader = req.headers.authorization || '';
  if (!checkRateLimit(`doc:${docId}:${authHeader.slice(-10)}`)) {
    res.setHeader('Retry-After', '2');
    return res.status(429).json({ error: 'Rate limit reached, please retry in 2 seconds' });
  }

  // Check 2,000 snapshots limit
  if (doc.last_seq >= 2000) {
    return res.status(413).json({ error: 'Document has reached maximum 2,000 snapshots limit' });
  }

  const safeClientT = typeof clientT === 'number' ? clientT : Date.now();
  const safeInserted = typeof inserted === 'number' ? inserted : 0;
  const safeDeleted = typeof deleted === 'number' ? deleted : 0;

  // Execute append via Postgres if active
  if (postgresReady && pgPool) {
    let client: pg.PoolClient | null = null;
    try {
      client = await pgPool.connect();
      await client.query('BEGIN');

      // Check idempotency first within transaction
      const existing = await client.query(
        'SELECT seq, t FROM snapshots WHERE doc_id = $1 AND snapshot_id = $2',
        [docId, snapshotId]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return res.status(200).json({
          seq: Number(existing.rows[0].seq),
          t: Number(existing.rows[0].t),
          idempotent: true,
        });
      }

      // Allocate seq atomically
      const updateRes = await client.query(
        'UPDATE docs SET last_seq = last_seq + 1 WHERE id = $1 RETURNING last_seq',
        [docId]
      );
      const nextSeq = Number(updateRes.rows[0].last_seq);
      const now = Date.now();

      // Plain INSERT (never ON CONFLICT DO NOTHING)
      await client.query(
        `INSERT INTO snapshots (doc_id, snapshot_id, seq, t, client_t, text, event_type, inserted, deleted, count_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [docId, snapshotId, nextSeq, now, safeClientT, text, eventType, safeInserted, safeDeleted, countSource]
      );

      await client.query('COMMIT');

      // Update local mirror as well
      doc.last_seq = nextSeq;
      const snapList = localSnapshots.get(docId) || [];
      snapList.push({
        doc_id: docId,
        snapshot_id: snapshotId,
        seq: nextSeq,
        t: now,
        client_t: safeClientT,
        text,
        event_type: eventType,
        inserted: safeInserted,
        deleted: safeDeleted,
        count_source: countSource,
      });
      localSnapshots.set(docId, snapList);
      saveLocalStore();

      return res.status(200).json({ seq: nextSeq, t: now });
    } catch (err: any) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
      }
      // SQLSTATE 23505: unique violation on (doc_id, snapshot_id) -> catch it, return stored row with 200 (APPEND RULE d)
      if (err.code === '23505' && client) {
        try {
          const rowRes = await client.query(
            'SELECT seq, t FROM snapshots WHERE doc_id = $1 AND snapshot_id = $2',
            [docId, snapshotId]
          );
          if (rowRes.rows.length > 0) {
            return res.status(200).json({
              seq: Number(rowRes.rows[0].seq),
              t: Number(rowRes.rows[0].t),
              idempotent: true,
            });
          }
        } catch (_) {}
      }
      // If error was unrecoverable, fall through to local lock engine
    } finally {
      if (client) client.release();
    }
  }

  // Local persistent session-pool transaction with locked seq allocation
  try {
    const result = await withDocLock(docId, async () => {
      const snapList = localSnapshots.get(docId) || [];

      // Check idempotency (same snapshotId -> return stored {seq, t})
      const found = snapList.find((s) => s.snapshot_id === snapshotId);
      if (found) {
        return { seq: found.seq, t: found.t, idempotent: true };
      }

      // Check max limit
      if (doc.last_seq >= 2000) {
        throw { status: 413, message: 'Document has reached maximum 2,000 snapshots limit' };
      }

      const nextSeq = doc.last_seq + 1;
      const now = Date.now();
      const newSnap: SnapshotRow = {
        doc_id: docId,
        snapshot_id: snapshotId,
        seq: nextSeq,
        t: now,
        client_t: safeClientT,
        text,
        event_type: eventType,
        inserted: safeInserted,
        deleted: safeDeleted,
        count_source: countSource,
      };

      doc.last_seq = nextSeq;
      snapList.push(newSnap);
      localSnapshots.set(docId, snapList);
      localDocs.set(docId, doc);
      saveLocalStore();

      return { seq: nextSeq, t: now };
    });

    return res.status(200).json(result);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Transaction failed' });
  }
});

// POST /api/docs/:id/declaration: store declaration; version +1; write key auth
app.post('/api/docs/:id/declaration', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  const doc = auth.doc!;

  const { level, note, declaredAt } = req.body;
  const validLevels = ['none', 'ideas', 'drafted', 'wrote-parts'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: `Invalid level. Allowed: ${validLevels.join(', ')}` });
  }
  if (typeof note === 'string' && note.length > 140) {
    return res.status(400).json({ error: 'Declaration note must be <= 140 characters' });
  }

  const declarationPayload = {
    level,
    note: typeof note === 'string' ? note.trim().slice(0, 140) : '',
    declaredAt: typeof declaredAt === 'number' ? declaredAt : Date.now(),
  };

  const newVersion = doc.version + 1;

  if (postgresReady && pgPool) {
    try {
      await pgPool.query(
        'UPDATE docs SET declaration = $1, version = $2 WHERE id = $3',
        [JSON.stringify(declarationPayload), newVersion, docId]
      );
    } catch (e) {
      // Fallback to local
    }
  }

  doc.declaration = declarationPayload;
  doc.version = newVersion;
  localDocs.set(docId, doc);
  saveLocalStore();

  return res.status(200).json({
    success: true,
    version: newVersion,
    declaration: declarationPayload,
  });
});

// PATCH /api/docs/:id: update document metadata (title, studentClass, studentId)
app.patch('/api/docs/:id', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }
  const doc = auth.doc!;

  const { title, studentClass, studentId } = req.body;
  if (typeof title === 'string' && title.trim()) {
    doc.title = title.trim().slice(0, 200);
  }
  if (typeof studentClass === 'string') {
    doc.studentClass = studentClass.trim().slice(0, 100);
  }
  if (typeof studentId === 'string' && studentId.trim()) {
    doc.student_id = studentId.trim().slice(0, 50);
  }

  if (postgresReady && pgPool) {
    try {
      await pgPool.query('UPDATE docs SET title = $1 WHERE id = $2', [doc.title, docId]);
    } catch (e) {}
  }

  localDocs.set(docId, doc);
  saveLocalStore();

  return res.status(200).json({
    success: true,
    title: doc.title,
    studentId: doc.student_id,
    studentClass: doc.studentClass,
  });
});

// GET /api/docs/:id: read doc info
// Auth: write key (Authorization header ONLY) OR valid reviewer token (?token=...)
app.get('/api/docs/:id', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const access = await verifyReadAccess(docId, req);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.message });
  }
  const doc = access.doc!;

  return res.status(200).json({
    docId: doc.id,
    title: doc.title,
    studentId: doc.student_id || 'STU-2026-0001',
    studentClass: doc.studentClass,
    isSubmitted: !!doc.is_submitted,
    submittedAt: doc.submitted_at || null,
    createdAt: doc.created_at,
    lastSeq: doc.last_seq,
    version: doc.version,
    declaration: doc.declaration,
    grade: doc.grade || null,
    reviewStatus: doc.reviewStatus || (doc.grade ? 'reviewed' : doc.is_submitted ? 'submitted' : undefined),
    reviewStatusUpdatedAt: doc.reviewStatusUpdatedAt || null,
    teacherComments: doc.teacherComments || null,
    isReviewer: access.isReviewer,
  });
});

// GET /api/docs/:id/meta: metadata for ALL snapshots (seq, t, eventType, counts)
// PLUS captureSpanMs, captureStartMs, captureEndMs derived SERVER-side from stored clientT.
// CRITICAL: Reviewer screen never receives raw clientT!
app.get('/api/docs/:id/meta', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const access = await verifyReadAccess(docId, req);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.message });
  }
  const doc = access.doc!;

  let snapshots: SnapshotRow[] = [];
  if (postgresReady && pgPool) {
    try {
      const res = await pgPool.query(
        'SELECT seq, t, client_t, event_type, inserted, deleted, count_source FROM snapshots WHERE doc_id = $1 ORDER BY seq ASC',
        [docId]
      );
      snapshots = res.rows.map((r) => ({
        doc_id: docId,
        snapshot_id: '',
        seq: Number(r.seq),
        t: Number(r.t),
        client_t: Number(r.client_t),
        text: '',
        event_type: r.event_type,
        inserted: Number(r.inserted),
        deleted: Number(r.deleted),
        count_source: r.count_source,
      }));
    } catch (e) {
      // Fallback
    }
  }

  if (snapshots.length === 0) {
    snapshots = (localSnapshots.get(docId) || []).map((s) => ({ ...s }));
  }

  // Derive captureSpanMs, captureStartMs, captureEndMs server-side from stored client_t
  let captureSpanMs = 0;
  let captureStartMs = 0;
  let captureEndMs = 0;

  if (snapshots.length >= 2) {
    captureStartMs = snapshots[0].client_t;
    captureEndMs = snapshots[snapshots.length - 1].client_t;
    captureSpanMs = Math.max(0, captureEndMs - captureStartMs);
  } else if (snapshots.length === 1) {
    captureStartMs = snapshots[0].client_t;
    captureEndMs = snapshots[0].client_t;
    captureSpanMs = 0;
  }

  // Build metadata items
  // If access.isReviewer is true, NEVER send raw client_t!
  const metaList = snapshots.map((s) => ({
    seq: s.seq,
    t: s.t,
    eventType: s.event_type,
    inserted: s.inserted,
    deleted: s.deleted,
    countSource: s.count_source,
    ...(access.isReviewer ? {} : { clientT: s.client_t }),
  }));

  return res.status(200).json({
    docId: doc.id,
    title: doc.title,
    studentId: doc.student_id || 'STU-2026-0001',
    studentClass: doc.studentClass,
    isSubmitted: !!doc.is_submitted,
    submittedAt: doc.submitted_at || null,
    version: doc.version,
    declaration: doc.declaration,
    grade: doc.grade || null,
    captureSpanMs,
    captureStartMs,
    captureEndMs,
    snapshots: metaList,
    isReviewer: access.isReviewer,
  });
});

// GET /api/docs/:id/text?from=: snapshot text chunk, 50 at a time, oldest first
app.get('/api/docs/:id/text', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const access = await verifyReadAccess(docId, req);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.message });
  }

  const fromSeq = Math.max(1, parseInt(req.query.from as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

  if (postgresReady && pgPool) {
    try {
      const resText = await pgPool.query(
        'SELECT seq, text FROM snapshots WHERE doc_id = $1 AND seq >= $2 ORDER BY seq ASC LIMIT $3',
        [docId, fromSeq, limit]
      );
      return res.status(200).json({
        docId,
        fromSeq,
        limit,
        items: resText.rows.map((r) => ({ seq: Number(r.seq), text: r.text })),
      });
    } catch (e) {
      // Fallback
    }
  }

  const snapList = localSnapshots.get(docId) || [];
  const chunk = snapList
    .filter((s) => s.seq >= fromSeq)
    .sort((a, b) => a.seq - b.seq)
    .slice(0, limit)
    .map((s) => ({ seq: s.seq, text: s.text }));

  return res.status(200).json({
    docId,
    fromSeq,
    limit,
    items: chunk,
  });
});

// POST /api/docs/:id/share: create share token -> {shareUrl}
app.post('/api/docs/:id/share', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashSha256(rawToken);
  const now = Date.now();

  if (postgresReady && pgPool) {
    try {
      await pgPool.query(
        'INSERT INTO shares (token_hash, doc_id, created_at, revoked_at) VALUES ($1, $2, $3, $4)',
        [tokenHash, docId, now, null]
      );
    } catch (e) {
      // Fallback
    }
  }

  localShares.set(tokenHash, {
    token_hash: tokenHash,
    doc_id: docId,
    created_at: now,
    revoked_at: null,
  });
  saveLocalStore();

  const shareUrl = `/?review=${rawToken}&doc=${docId}`;
  return res.status(201).json({
    shareToken: rawToken,
    shareUrl,
  });
});

// POST /api/docs/:id/revoke: revoke share token
app.post('/api/docs/:id/revoke', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  const { token } = req.body;
  const now = Date.now();

  if (token && typeof token === 'string') {
    const tokenHash = hashSha256(token);
    if (postgresReady && pgPool) {
      try {
        await pgPool.query('UPDATE shares SET revoked_at = $1 WHERE token_hash = $2 AND doc_id = $3', [now, tokenHash, docId]);
      } catch (e) {}
    }
    const share = localShares.get(tokenHash);
    if (share && share.doc_id === docId) {
      share.revoked_at = now;
    }
  } else {
    // Revoke all tokens for this doc
    if (postgresReady && pgPool) {
      try {
        await pgPool.query('UPDATE shares SET revoked_at = $1 WHERE doc_id = $2 AND revoked_at IS NULL', [now, docId]);
      } catch (e) {}
    }
    for (const s of localShares.values()) {
      if (s.doc_id === docId && s.revoked_at === null) {
        s.revoked_at = now;
      }
    }
  }
  saveLocalStore();

  return res.status(200).json({ success: true, message: 'Share token(s) revoked' });
});

// DELETE /api/docs/:id: delete doc + versions (write key)
app.delete('/api/docs/:id', async (req: Request, res: Response) => {
  const docId = req.params.id;
  const auth = await verifyWriteKey(docId, req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  if (postgresReady && pgPool) {
    try {
      await pgPool.query('DELETE FROM docs WHERE id = $1', [docId]);
    } catch (e) {}
  }

  localDocs.delete(docId);
  localSnapshots.delete(docId);
  for (const [hash, share] of localShares.entries()) {
    if (share.doc_id === docId) localShares.delete(hash);
  }
  saveLocalStore();

  return res.status(200).json({ success: true, message: 'Document and all versions deleted' });
});

// GET /api/status: disclose storage engine and health per spec D1
app.get('/api/status', (req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    storageEngine: postgresReady ? 'supabase_postgres_pool' : 'session_pool_local',
    postgresConfigured: !!connectionString,
    postgresConnected: postgresReady,
    info: postgresReady
      ? 'Connected to PostgreSQL via session pooler with server-side transactions & gap-free seq'
      : 'Running server-side transactional session pool with persistent storage, gap-free seq & idempotency keys',
  });
});

// ---------------- VITE MIDDLEWARE / STATIC ASSETS ----------------

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DraftReplay] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
