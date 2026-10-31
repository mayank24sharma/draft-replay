export type AILevel = 'none' | 'ideas' | 'drafted' | 'wrote-parts';

export interface AIDeclaration {
  level: AILevel;
  note: string;
  declaredAt: number;
}

export interface GradeRubric {
  processIntegrity: number; // 0 - 25
  aiDisclosure: number;     // 0 - 25
  writingQuality: number;   // 0 - 25
  revisionDepth: number;    // 0 - 25
}

export type LetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F';

export type ReviewStatus = 'submitted' | 'seen' | 'under_review' | 'reviewed';

export interface GradeRecord {
  score: number; // 0 - 100
  letterGrade: LetterGrade;
  rubric: GradeRubric;
  feedback: string;
  gradingExplanation?: string; // Explanation of teacher's grading process (replay analysis, revision depth, AI match)
  gradedAt: number;
  gradedBy: string;
  status: 'graded' | 'needs-revision';
}

export interface StudentProfile {
  studentId: string;
  studentClass: string;
}

export type EventType = 'paste' | 'large_delete' | 'undo' | 'pause';
export type CountSource = 'event' | 'diff-estimate';

export interface Snapshot {
  docId: string;
  snapshotId: string;
  seq: number;
  t: number;
  clientT: number;
  text: string;
  eventType: EventType;
  inserted: number;
  deleted: number;
  countSource: CountSource;
}

export interface DocumentMeta {
  docId: string;
  title: string;
  studentId: string;
  studentClass?: string;
  createdAt: number;
  lastSeq: number;
  version: number;
  declaration: AIDeclaration | null;
  grade?: GradeRecord | null;
  reviewStatus?: ReviewStatus;
  reviewStatusUpdatedAt?: number;
  teacherComments?: string;
  isDemo?: boolean;
  isSubmitted?: boolean;
  submittedAt?: number;
}

export interface ServerMetaResponse {
  docId: string;
  title: string;
  studentId?: string;
  studentClass?: string;
  isSubmitted?: boolean;
  submittedAt?: number;
  version: number;
  declaration: AIDeclaration | null;
  grade?: GradeRecord | null;
  reviewStatus?: ReviewStatus;
  reviewStatusUpdatedAt?: number;
  teacherComments?: string;
  isDemo?: boolean;
  captureSpanMs: number;
  captureStartMs: number;
  captureEndMs: number;
  snapshots: Array<{
    snapshotId?: string;
    seq: number;
    t: number;
    eventType: EventType;
    inserted: number;
    deleted: number;
    countSource: CountSource;
    clientT?: number;
  }>;
  isReviewer?: boolean;
}

export interface ExportBundle {
  title: string;
  studentId?: string;
  studentClass?: string;
  version: number;
  exportTime: number;
  snapshots: Array<{
    seq: number;
    t: number;
    eventType: EventType;
    inserted: number;
    deleted: number;
    countSource: CountSource;
    text: string;
  }>;
  declaration: AIDeclaration | null;
  grade?: GradeRecord | null;
  captureSpanMs?: number;
  captureStartMs?: number;
  captureEndMs?: number;
}

