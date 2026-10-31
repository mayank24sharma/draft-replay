import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Info,
  GraduationCap,
  Sparkles,
  Award,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { DocumentMeta, ReviewStatus } from '../types';
import { CaptureEngine } from '../lib/capture';
import { getWriteKey, saveLocalDoc, getLocalSnapshots, estimateCacheUsageBytes } from '../lib/db';
import { subscribeSyncStatus } from '../lib/sync';
import { SubmitConfirmModal } from './SubmitConfirmModal';
import { StudentIdModal } from './StudentIdModal';
import { formatSaveTimestamp } from '../lib/time';

interface Props {
  currentDoc: DocumentMeta;
  onDocChange: (doc: DocumentMeta) => void;
  onOpenWhatWeRecord: () => void;
  onOpenTeachersCorner: () => void;
  onOpenDeclare: () => void;
  onOpenExport?: () => void;
  onOpenReplay?: () => void;
  onOpenFeedbackTracker?: () => void;
  isReadOnlyDemo?: boolean;
}

export const WriteView: React.FC<Props> = ({
  currentDoc,
  onDocChange,
  onOpenWhatWeRecord,
  onOpenTeachersCorner,
  onOpenDeclare,
  onOpenFeedbackTracker,
  isReadOnlyDemo = false,
}) => {
  const [text, setText] = useState<string>('');
  const [title, setTitle] = useState<string>(currentDoc.title || '');
  const [studentClass, setStudentClass] = useState<string>(currentDoc.studentClass || '');
  const [studentId, setStudentId] = useState<string>(currentDoc.studentId || 'STU-2026-0001');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Submit confirmation modal state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [showStudentIdModal, setShowStudentIdModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [ticker, setTicker] = useState<{ snapshotCount: number; pastes: number; deletions: number }>({
    snapshotCount: currentDoc.lastSeq || 0,
    pastes: 0,
    deletions: 0,
  });

  const [syncStatus, setSyncStatus] = useState<{ pendingCount: number; isOnline: boolean; isSyncing: boolean }>({
    pendingCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
  });

  const [cacheWarning, setCacheWarning] = useState<string | null>(null);
  const [tabLocked, setTabLocked] = useState<boolean>(false);
  const [dismissTryIt, setDismissTryIt] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('draftreplay_dismiss_tryit') === 'true';
  });

  const captureEngineRef = useRef<CaptureEngine | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimeoutRef = useRef<any>(null);

  const isLocked = !!currentDoc.isSubmitted || isReadOnlyDemo;

  // Sync status listener
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Multi-tab single-author guard (D6)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channelName = `draftreplay-lease-${currentDoc.docId}`;
    const channel = new BroadcastChannel(channelName);
    const tabId = Math.random().toString(36).substring(2);

    channel.postMessage({ type: 'claim', tabId });

    channel.onmessage = (event) => {
      if (event.data?.type === 'claim' && event.data.tabId !== tabId) {
        setTabLocked(true);
      }
    };

    return () => {
      channel.postMessage({ type: 'release', tabId });
      channel.close();
    };
  }, [currentDoc.docId]);

  // Check cache size warning (~4 MB per Rule 7)
  useEffect(() => {
    estimateCacheUsageBytes().then((bytes) => {
      if (bytes > 3.8 * 1024 * 1024) {
        setCacheWarning(`Local cache is near ${(bytes / (1024 * 1024)).toFixed(1)} MB. Please sync or export.`);
      } else {
        setCacheWarning(null);
      }
    });
  }, [ticker.snapshotCount]);

  // Load document content and snapshots
  useEffect(() => {
    setTitle(currentDoc.title || '');
    setStudentClass(currentDoc.studentClass || '');
    setStudentId(currentDoc.studentId || 'STU-2026-0001');

    getLocalSnapshots(currentDoc.docId).then((snaps) => {
      const latestText = snaps.length > 0 ? snaps[snaps.length - 1].text : '';
      setText(latestText);

      let pastes = 0;
      let deletions = 0;
      for (const s of snaps) {
        if (s.eventType === 'paste') pastes++;
        if (s.eventType === 'large_delete') deletions += s.deleted;
      }

      setTicker({
        snapshotCount: snaps.length,
        pastes,
        deletions,
      });

      // Initialize Capture Engine
      captureEngineRef.current = new CaptureEngine(currentDoc.docId, latestText, {
        onSnapshotSaved: (snap) => {
          setTicker((prev) => ({
            ...prev,
            snapshotCount: snap.seq,
          }));
        },
        onPasteToast: () => {
          showNeutralToast('Pasted as a block');
        },
        onStatsUpdate: (stats) => {
          setTicker({
            snapshotCount: stats.snapshotCount,
            pastes: stats.totalPastes,
            deletions: stats.totalDeletions,
          });
        },
      });

      captureEngineRef.current.reset(currentDoc.docId, latestText, snaps.length, pastes, deletions);
    });
  }, [currentDoc.docId]);

  // The ONLY toast in DraftReplay: neutral amber toast (judges nothing per Rule 4)
  const showNeutralToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2800);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isLocked || tabLocked) return;
    const newText = e.target.value;
    setText(newText);
    const nativeEvent = e.nativeEvent as InputEvent;
    const inputType = nativeEvent?.inputType;

    if (captureEngineRef.current) {
      captureEngineRef.current.handleInput(newText, inputType);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isLocked || tabLocked) return;
    if (captureEngineRef.current) {
      captureEngineRef.current.handlePasteEvent(e);
    }
  };

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const newTitle = e.target.value.slice(0, 200);
    setTitle(newTitle);
    const updated = { ...currentDoc, title: newTitle };
    onDocChange(updated);
    await saveLocalDoc(updated);
    syncDocMetadata(updated);
  };

  const handleStudentClassChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const val = e.target.value.slice(0, 100);
    setStudentClass(val);
    if (val.trim()) setValidationError(null);
    const updated = { ...currentDoc, studentClass: val };
    onDocChange(updated);
    await saveLocalDoc(updated);
    syncDocMetadata(updated);
  };

  const handleSaveStudentId = async (newStudentId: string) => {
    setStudentId(newStudentId);
    const updated = { ...currentDoc, studentId: newStudentId };
    onDocChange(updated);
    await saveLocalDoc(updated);
    syncDocMetadata(updated);
    showNeutralToast(`Student ID updated to ${newStudentId}`);
  };

  const syncDocMetadata = async (doc: DocumentMeta) => {
    try {
      const writeKey = await getWriteKey(doc.docId);
      if (writeKey && typeof navigator !== 'undefined' && navigator.onLine) {
        await fetch(`/api/docs/${doc.docId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${writeKey}`,
          },
          body: JSON.stringify({
            title: doc.title,
            studentClass: doc.studentClass,
            studentId: doc.studentId,
          }),
        }).catch(() => {});
      }
    } catch (_) {}
  };

  const handlePreNavFlush = () => {
    if (captureEngineRef.current) {
      captureEngineRef.current.flushPendingPause(text);
    }
  };

  // Click Submit Essay -> triggers confirmation prompt per user request
  const handleSubmitClick = () => {
    if (!studentClass.trim()) {
      setValidationError('Please enter your Class / Grade before submitting.');
      return;
    }
    if (!text.trim()) {
      setValidationError('Your essay is empty. Write your essay before submitting.');
      return;
    }
    setValidationError(null);
    handlePreNavFlush();
    setShowSubmitConfirm(true);
  };

  // Final Confirmation: locks document and sends to Teacher's Corner
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const now = Date.now();
      const writeKey = await getWriteKey(currentDoc.docId);

      // Lock locally
      const updated: DocumentMeta = {
        ...currentDoc,
        studentId,
        studentClass,
        isSubmitted: true,
        submittedAt: now,
      };
      await saveLocalDoc(updated);
      onDocChange(updated);

      // Lock on server if online
      if (writeKey && typeof navigator !== 'undefined' && navigator.onLine) {
        await fetch(`/api/docs/${currentDoc.docId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${writeKey}`,
          },
        }).catch(() => {});
      }

      setShowSubmitConfirm(false);
      showNeutralToast("Essay submitted to Teacher's Corner!");
    } catch (err: any) {
      setValidationError('Submission error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const grade = currentDoc.grade;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] dark:bg-[#101114] text-[#171923] dark:text-[#ECEEF2] max-w-6xl w-full mx-auto p-3 md:p-6 select-text transition-colors duration-180">
      {/* Toast Notification Container */}
      {toastVisible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-500/60 shadow-lg shadow-amber-950/20 text-amber-900 dark:text-amber-200 text-xs md:text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Tab lease lock banner (D6) */}
      {tabLocked && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-700/80 rounded-xl text-red-900 dark:text-red-200 text-xs md:text-sm flex items-center gap-2 shadow-xs">
          <Lock className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>
            <strong>Single-author MVP:</strong> This document is open elsewhere. Editing in this tab is paused to prevent merge conflicts.
          </span>
        </div>
      )}

      {/* Local Cache warning near ~4 MB (Rule 7) */}
      {cacheWarning && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-600/70 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{cacheWarning}</span>
        </div>
      )}

      {/* Read-Only Demo Notification Badge (Rule 5) */}
      {isReadOnlyDemo && (
        <div className="mb-4 p-3 bg-[#FFFFFF] dark:bg-[#17191D] border border-amber-300 dark:border-amber-600/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-between shadow-xs">
          <span className="uppercase tracking-widest font-bold">FICTIONAL DEMO DOCUMENT — READ ONLY</span>
          <span className="text-[#64748B] dark:text-[#9298A3] font-normal">Editing disabled to protect seed timeline</span>
        </div>
      )}

      {/* TEACHER MARKS & EVALUATION CARD (If teacher has marked this essay) */}
      {grade && (
        <div className="mb-5 p-5 bg-[#FFFFFF] dark:bg-[#17191D] border border-emerald-300 dark:border-emerald-500/50 rounded-2xl shadow-sm animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-[#E2E8F0] dark:border-[#292D33]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
                    Teacher&apos;s Evaluation & Final Marks
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      grade.status === 'graded'
                        ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-500/60 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {grade.status === 'graded' ? 'Graded · Approved' : 'Needs Revision'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#9298A3]">
                  Evaluated by {grade.gradedBy || 'Teacher'} · {formatSaveTimestamp(grade.gradedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#F8FAFC] dark:bg-[#101114] px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
              <div className="text-right">
                <span className="text-[10px] text-[#64748B] dark:text-[#9298A3] block uppercase font-semibold">Total Score</span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {grade.score} <span className="text-xs text-[#64748B] dark:text-[#9298A3]">/ 100</span>
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {grade.letterGrade}
              </div>
            </div>
          </div>

          {/* Rubric Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs">
              <span className="text-[#64748B] dark:text-[#9298A3] block text-[10px] uppercase font-semibold">1. Process Integrity</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{grade.rubric.processIntegrity} / 25 pts</span>
            </div>
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs">
              <span className="text-[#64748B] dark:text-[#9298A3] block text-[10px] uppercase font-semibold">2. AI Disclosure</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{grade.rubric.aiDisclosure} / 25 pts</span>
            </div>
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs">
              <span className="text-[#64748B] dark:text-[#9298A3] block text-[10px] uppercase font-semibold">3. Writing Quality</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{grade.rubric.writingQuality} / 25 pts</span>
            </div>
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs">
              <span className="text-[#64748B] dark:text-[#9298A3] block text-[10px] uppercase font-semibold">4. Revision Depth</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{grade.rubric.revisionDepth} / 25 pts</span>
            </div>
          </div>

          {/* Teacher Feedback Note */}
          {grade.feedback && (
            <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs">
              <span className="text-[#64748B] dark:text-[#9298A3] font-semibold block mb-1">Teacher&apos;s Remarks:</span>
              <p className="text-[#171923] dark:text-[#ECEEF2] italic whitespace-pre-line">&quot;{grade.feedback}&quot;</p>
            </div>
          )}
        </div>
      )}

      {/* SUBMISSION LOCKED BANNER (Per User Request: after submit, no changes) */}
      {currentDoc.isSubmitted && !isReadOnlyDemo && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/60 rounded-2xl text-emerald-900 dark:text-emerald-200 text-xs md:text-sm flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-[#171923] dark:text-white block">
                Essay Submitted & Locked — No further changes can be applied.
              </span>
              <span className="text-emerald-700 dark:text-emerald-300 text-xs">
                Your writing progression has been saved and sent to Teacher&apos;s Corner for review.
              </span>
            </div>
          </div>

          <button
            onClick={onOpenTeachersCorner}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Go to Teacher&apos;s Corner</span>
          </button>
        </div>
      )}

      {/* Student Required Info Validation Banner */}
      {validationError && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-600 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 animate-in fade-in shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">{validationError}</span>
        </div>
      )}

      {/* Student Details Card (Class and UNIQUE STUDENT ID) */}
      <div className="mb-4 p-3.5 bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Unique Student ID Badge & Switcher */}
          <div className="min-w-[150px]">
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#9298A3] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Student ID</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#101114] border border-[#E2E8F0] dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold shadow-xs">
                {studentId}
              </span>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => setShowStudentIdModal(true)}
                  className="p-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#22252B] hover:bg-[#E2E8F0] dark:hover:bg-[#292D33] text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-white transition-colors cursor-pointer"
                  title="Switch or regenerate Student ID"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Class / Grade Input (Required) */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#9298A3] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Class / Grade</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">*</span>
            </label>
            <input
              type="text"
              value={studentClass}
              disabled={isLocked}
              onChange={handleStudentClassChange}
              placeholder="e.g. Class 8A"
              className={`w-full bg-[#FFFFFF] dark:bg-[#14161A] border ${
                !studentClass.trim()
                  ? 'border-amber-300 dark:border-amber-700/60 focus:border-emerald-600 dark:focus:border-emerald-500'
                  : 'border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500'
              } rounded-xl px-3 py-1.5 text-xs md:text-sm text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden disabled:opacity-75 disabled:cursor-not-allowed`}
              required
            />
          </div>
        </div>

        {/* Lock indicator */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div
            className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
              currentDoc.isSubmitted
                ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-[#F1F5F9] dark:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-[#9298A3]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{currentDoc.isSubmitted ? 'Locked & Submitted' : 'Student Mode'}</span>
          </div>
        </div>
      </div>

      {/* STUDENT AI-USE DECLARATION CARD */}
      <div className="mb-4 p-3 bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#171923] dark:text-[#ECEEF2]">
                AI Assistance Self-Declaration:
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                  currentDoc.declaration
                    ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-600/50 text-amber-800 dark:text-amber-300'
                }`}
              >
                {currentDoc.declaration
                  ? currentDoc.declaration.level === 'none'
                    ? 'Certified: No AI Help'
                    : currentDoc.declaration.level === 'ideas'
                    ? 'Certified: AI for Ideas Only'
                    : currentDoc.declaration.level === 'drafted'
                    ? 'Certified: AI Helped Draft'
                    : 'Certified: AI Wrote Parts'
                  : 'Pending Student Declaration'}
              </span>
            </div>
            {currentDoc.declaration?.note ? (
              <p className="text-[11px] text-[#64748B] dark:text-[#9298A3] italic mt-0.5 line-clamp-1">
                &quot;{currentDoc.declaration.note}&quot;
              </p>
            ) : (
              <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500 mt-0.5">
                Declare whether and how you used AI tools (brainstorming, drafting, or none).
              </p>
            )}
          </div>
        </div>

        {!currentDoc.isSubmitted && (
          <button
            type="button"
            onClick={onOpenDeclare}
            className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E2E8F0] dark:border-[#292D33] shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{currentDoc.declaration ? 'Edit Declaration' : 'Declare AI Use'}</span>
          </button>
        )}
      </div>

      {/* First Visit "Try it yourself" instructions card */}
      {!dismissTryIt && !isReadOnlyDemo && !currentDoc.isSubmitted && (
        <div className="mb-4 p-4 bg-[#FFFFFF] dark:bg-[#17191D] border border-emerald-300 dark:border-emerald-500/30 rounded-2xl shadow-xs relative">
          <button
            onClick={() => {
              setDismissTryIt(true);
              try {
                localStorage.setItem('draftreplay_dismiss_tryit', 'true');
              } catch (_) {}
            }}
            className="absolute top-3 right-3 text-[#94A3B8] hover:text-[#64748B] dark:text-zinc-500 dark:hover:text-zinc-300 text-xs px-2 py-1 cursor-pointer"
          >
            Dismiss
          </button>
          <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs tracking-wider uppercase">
            <Info className="w-3.5 h-3.5" />
            <span>Essay Instructions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#64748B] dark:text-zinc-300">
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#101114] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">1.</span> Verify your Student ID and Class above.
            </div>
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#101114] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">2.</span> Write your essay. Each pause automatically captures save states.
            </div>
            <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#101114] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-1">3.</span> Declare your AI use and click <strong>Submit Essay to Teacher</strong> to lock it.
            </div>
          </div>
        </div>
      )}

      {/* Document Title Header & Sync Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <input
          type="text"
          value={title}
          disabled={isLocked || tabLocked}
          onChange={handleTitleChange}
          placeholder="Untitled Essay..."
          className="bg-transparent border-b border-transparent hover:border-[#E2E8F0] dark:hover:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 text-xl md:text-2xl font-bold text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden pb-1 transition-colors flex-1 disabled:opacity-75 disabled:cursor-not-allowed"
        />

        {/* Live Status and Info */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div
            className={`text-xs px-2.5 py-1 rounded-full font-mono font-medium flex items-center gap-1.5 ${
              syncStatus.pendingCount === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                : 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus.pendingCount === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span>
              {syncStatus.pendingCount === 0
                ? 'Synced'
                : `Pending: ${syncStatus.pendingCount}`}
            </span>
          </div>

          {/* Track Marks & Feedback Button */}
          {onOpenFeedbackTracker && (
            <button
              onClick={onOpenFeedbackTracker}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Track my essay submissions, review statuses, and teacher marks"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Track Feedback</span>
            </button>
          )}

          <button
            onClick={onOpenWhatWeRecord}
            className="p-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-zinc-200 transition-colors cursor-pointer shadow-xs"
            title="What DraftReplay records and why"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Monospace Ticker */}
      <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] font-mono text-xs text-[#64748B] dark:text-[#9298A3] flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div>
          Snapshot #{ticker.snapshotCount} saved · {ticker.pastes} pastes · {ticker.deletions} deletions
        </div>
        <div className="text-[11px] text-[#94A3B8] dark:text-zinc-500">
          ID: {studentId} · {currentDoc.isSubmitted ? 'Submitted & Locked' : 'Draft In Progress'}
        </div>
      </div>

      {/* TEACHER REVIEW STATUS & FEEDBACK TRACKER (Visible when submitted) */}
      {currentDoc.isSubmitted && (() => {
        const reviewStatus: ReviewStatus = currentDoc.reviewStatus || (currentDoc.grade ? 'reviewed' : 'submitted');
        const step = reviewStatus === 'reviewed' ? 3 : reviewStatus === 'under_review' ? 2 : reviewStatus === 'seen' ? 1 : 0;

        return (
          <div className="mb-4 p-4 rounded-2xl border transition-all bg-[#FFFFFF] dark:bg-[#17191D] border-[#E2E8F0] dark:border-[#292D33] shadow-xs space-y-3">
            {/* Review Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0] dark:border-[#292D33]">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-[#171923] dark:text-[#ECEEF2]">
                  Teacher Review & Evaluation Tracking
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  reviewStatus === 'reviewed'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : reviewStatus === 'under_review'
                    ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-600/40'
                    : reviewStatus === 'seen'
                    ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                    : 'bg-[#F1F5F9] dark:bg-[#22252B] text-[#64748B] dark:text-zinc-300 border-[#E2E8F0] dark:border-[#292D33]'
                }`}>
                  {reviewStatus === 'reviewed' ? '● Reviewed & Graded' :
                   reviewStatus === 'under_review' ? '● Under Review' :
                   reviewStatus === 'seen' ? '● Seen by Teacher' : '● Submitted (Pending Review)'}
                </span>

                {onOpenFeedbackTracker && (
                  <button
                    onClick={onOpenFeedbackTracker}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    View All My Essays
                  </button>
                )}
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
              <div className={`p-1.5 rounded-lg border ${step >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40' : 'bg-[#F8FAFC] dark:bg-[#14161A] text-[#94A3B8] dark:text-zinc-600 border-[#E2E8F0] dark:border-[#292D33]'}`}>
                1. Submitted
              </div>
              <div className={`p-1.5 rounded-lg border ${step >= 1 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40' : 'bg-[#F8FAFC] dark:bg-[#14161A] text-[#94A3B8] dark:text-zinc-600 border-[#E2E8F0] dark:border-[#292D33]'}`}>
                2. Seen
              </div>
              <div className={`p-1.5 rounded-lg border ${step >= 2 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-600/40' : 'bg-[#F8FAFC] dark:bg-[#14161A] text-[#94A3B8] dark:text-zinc-600 border-[#E2E8F0] dark:border-[#292D33]'}`}>
                3. Under Review
              </div>
              <div className={`p-1.5 rounded-lg border ${step >= 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-[#F8FAFC] dark:bg-[#14161A] text-[#94A3B8] dark:text-zinc-600 border-[#E2E8F0] dark:border-[#292D33]'}`}>
                4. Reviewed & Graded
              </div>
            </div>

            {/* If Graded: Show Marks, Rubric & Process Notes */}
            {currentDoc.grade ? (
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {currentDoc.grade.score}
                      <span className="text-xs text-[#64748B] dark:text-zinc-400 font-normal">/100</span>
                    </span>
                    <span className="font-bold text-xs px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                      Grade: {currentDoc.grade.letterGrade}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-zinc-400 font-medium">
                      ({currentDoc.grade.status === 'graded' ? 'Final Marks Approved' : 'Needs Revision'})
                    </span>
                  </div>

                  <span className="text-xs font-mono text-[#94A3B8] dark:text-zinc-500">
                    Graded by {currentDoc.grade.gradedBy} · {formatSaveTimestamp(currentDoc.grade.gradedAt)}
                  </span>
                </div>

                {/* 4 Rubric breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33]">
                    <span className="text-[10px] text-[#64748B] dark:text-zinc-400 block">Process Integrity</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentDoc.grade.rubric.processIntegrity}/25</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33]">
                    <span className="text-[10px] text-[#64748B] dark:text-zinc-400 block">AI Disclosure</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentDoc.grade.rubric.aiDisclosure}/25</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33]">
                    <span className="text-[10px] text-[#64748B] dark:text-zinc-400 block">Writing Quality</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentDoc.grade.rubric.writingQuality}/25</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33]">
                    <span className="text-[10px] text-[#64748B] dark:text-zinc-400 block">Revision Depth</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentDoc.grade.rubric.revisionDepth}/25</span>
                  </div>
                </div>

                {/* Teacher's Process Explanation (User Request) */}
                {(currentDoc.grade.gradingExplanation || currentDoc.teacherComments) && (
                  <div className="p-2.5 bg-[#FFFFFF] dark:bg-[#17191D] rounded-lg border border-[#E2E8F0] dark:border-[#292D33] text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase">
                      Teacher&apos;s Grading Process & Reviewer Comments:
                    </span>
                    <p className="text-xs text-[#171923] dark:text-zinc-200 mt-0.5 leading-relaxed">
                      {currentDoc.grade.gradingExplanation || currentDoc.teacherComments}
                    </p>
                  </div>
                )}

                {/* Teacher Feedback Quote */}
                {currentDoc.grade.feedback && (
                  <div className="text-xs text-[#171923] dark:text-zinc-200 italic p-2 bg-[#FFFFFF] dark:bg-[#17191D] rounded-lg border border-[#E2E8F0] dark:border-[#292D33]">
                    &quot;{currentDoc.grade.feedback}&quot;
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs text-[#64748B] dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {reviewStatus === 'under_review'
                    ? 'Your teacher is currently reviewing your essay replay cadence and revision depth. Marks and evaluation explanation will be published here.'
                    : reviewStatus === 'seen'
                    ? 'Your essay has been received and opened by your teacher. Evaluation is queued.'
                    : 'Essay submitted and locked. Waiting for teacher evaluation in Teacher\'s Corner.'}
                </span>
                {onOpenFeedbackTracker && (
                  <button
                    onClick={onOpenFeedbackTracker}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                  >
                    All Submissions
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Large Text Area - Pristine Editor Background (#FFFFFF in Light, #14161A in Dark) */}
      <div className="flex-1 min-h-[50vh] flex flex-col rounded-2xl border border-[#E2E8F0] dark:border-[#292D33] bg-[#FFFFFF] dark:bg-[#14161A] focus-within:border-emerald-600 dark:focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-600/30 dark:focus-within:ring-emerald-500/40 transition-all overflow-hidden relative shadow-xs">
        <textarea
          ref={textareaRef}
          value={text}
          disabled={isLocked || tabLocked}
          onChange={handleTextChange}
          onPaste={handlePaste}
          placeholder="Write your essay here... Every change and pause is recorded. When you are done, certify your AI declaration and click Submit Essay below."
          className="flex-1 w-full h-full p-5 md:p-8 bg-transparent text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 font-sans text-base md:text-lg leading-relaxed outline-hidden resize-none selection:bg-emerald-500/20 disabled:opacity-75 disabled:cursor-not-allowed"
        />
      </div>

      {/* Bottom Action Bar: SUBMIT ESSAY TO TEACHER */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {!currentDoc.isSubmitted ? (
            <button
              onClick={handleSubmitClick}
              disabled={tabLocked}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white font-bold rounded-xl text-sm flex items-center gap-2.5 transition-all shadow-md hover:shadow-emerald-900/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Submit Essay to Teacher</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Essay is Submitted & Locked</span>
              </div>
              {onOpenFeedbackTracker && (
                <button
                  onClick={onOpenFeedbackTracker}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Track Feedback & Marks</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenTeachersCorner}
            className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Open Teacher&apos;s Corner</span>
          </button>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleConfirmSubmit}
        studentId={studentId}
        studentClass={studentClass}
        essayTitle={title}
        charCount={text.length}
        hasDeclaration={!!currentDoc.declaration}
        isSubmitting={isSubmitting}
      />

      {/* Unique Student ID Switcher/Generator Modal */}
      <StudentIdModal
        isOpen={showStudentIdModal}
        onClose={() => setShowStudentIdModal(false)}
        currentStudentId={studentId}
        onSaveStudentId={handleSaveStudentId}
      />
    </div>
  );
};
