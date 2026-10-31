import React, { useState, useEffect } from 'react';
import {
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Terminal,
  Plus,
  Layers,
  ShieldAlert,
  GraduationCap,
  CheckCircle2,
  Lock,
  Award,
} from 'lucide-react';
import { DocumentMeta, Snapshot, AIDeclaration, ExportBundle } from './types';
import { WriteView } from './components/WriteView';
import { ReplayPlayer } from './components/ReplayPlayer';
import { ReviewerView } from './components/ReviewerView';
import { TeachersCornerView } from './components/TeachersCornerView';
import { TeacherAccessModal } from './components/TeacherAccessModal';
import { DeclareModal } from './components/DeclareModal';
import { WhatWeRecordModal } from './components/WhatWeRecordModal';
import { ExportImportModal } from './components/ExportImportModal';
import { TestHarnessModal } from './components/TestHarnessModal';
import { StudentFeedbackTrackerModal } from './components/StudentFeedbackTrackerModal';
import { ThemeToggle } from './components/ThemeToggle';
import { MomenWatermark } from './components/MomenWatermark';
import {
  saveLocalDoc,
  getLocalDoc,
  getAllLocalDocs,
  saveWriteKey,
  getWriteKey,
  getLocalSnapshots,
  clearAllLocalData,
} from './lib/db';
import { generateDocId, generateWriteKey, computeSha256 } from './lib/crypto';
import { generateDemoSeeds } from './lib/seeds';

export default function App() {
  const [currentDoc, setCurrentDoc] = useState<DocumentMeta | null>(null);
  const [viewMode, setViewMode] = useState<'write' | 'teachers-corner' | 'replay' | 'reviewer'>('write');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [replaySource, setReplaySource] = useState<'write' | 'teachers-corner'>('teachers-corner');

  // Modals state
  const [showDeclare, setShowDeclare] = useState<boolean>(false);
  const [showWhatWeRecord, setShowWhatWeRecord] = useState<boolean>(false);
  const [showExportImport, setShowExportImport] = useState<boolean>(false);
  const [showTestHarness, setShowTestHarness] = useState<boolean>(false);
  const [showFeedbackTracker, setShowFeedbackTracker] = useState<boolean>(false);

  // Teacher Authentication state (locked with yokoso@1)
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(() => {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('draftreplay_teacher_auth') === 'true';
  });
  const [showTeacherAccessModal, setShowTeacherAccessModal] = useState<boolean>(false);
  const [pendingTeacherAction, setPendingTeacherAction] = useState<(() => void) | null>(null);

  const requireTeacherAccess = (action: () => void) => {
    if (isTeacherAuthenticated) {
      action();
    } else {
      setPendingTeacherAction(() => action);
      setShowTeacherAccessModal(true);
    }
  };

  const handleTeacherAccessSuccess = () => {
    setIsTeacherAuthenticated(true);
    try {
      sessionStorage.setItem('draftreplay_teacher_auth', 'true');
    } catch (_) {}
    if (pendingTeacherAction) {
      const act = pendingTeacherAction;
      setPendingTeacherAction(null);
      act();
    } else {
      setViewMode('teachers-corner');
    }
  };

  const handleLockTeacherCorner = () => {
    setIsTeacherAuthenticated(false);
    try {
      sessionStorage.removeItem('draftreplay_teacher_auth');
    } catch (_) {}
    if (viewMode === 'teachers-corner') {
      setViewMode('write');
    }
  };

  // Reviewer route state
  const [reviewerDocId, setReviewerDocId] = useState<string | null>(null);
  const [reviewerToken, setReviewerToken] = useState<string | null>(null);
  const [importedBundle, setImportedBundle] = useState<ExportBundle | null>(null);

  const [hasWriteKey, setHasWriteKey] = useState<boolean>(true);
  const [allDocs, setAllDocs] = useState<DocumentMeta[]>([]);

  // Helper to create a fresh new document with empty text
  const createFreshDoc = async (): Promise<DocumentMeta> => {
    const docId = generateDocId();
    const writeKey = generateWriteKey();
    const keyHash = await computeSha256(writeKey);

    const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newDoc: DocumentMeta = {
      docId,
      title: 'Untitled Essay',
      studentId,
      studentClass: '',
      createdAt: Date.now(),
      lastSeq: 0,
      version: 1,
      declaration: null,
      grade: null,
      isDemo: false,
      isSubmitted: false,
    };

    await saveLocalDoc(newDoc);
    await saveWriteKey(docId, writeKey);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await fetch('/api/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            docId,
            title: newDoc.title,
            studentId,
            studentClass: newDoc.studentClass,
            keyHash,
          }),
        });
      } catch (_) {}
    }

    return newDoc;
  };

  // Initial load: Always start from a clean new document with empty text area per user requests 8 & 9
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const revToken = params.get('review');
    const revDoc = params.get('doc');
    const isDemoParam = params.get('demo') === '1';

    if (revToken && revDoc) {
      setReviewerToken(revToken);
      setReviewerDocId(revDoc);
      setViewMode('reviewer');
      return;
    }

    async function initApp() {
      if (isDemoParam) {
        const { historyDoc } = await generateDemoSeeds();
        setCurrentDoc(historyDoc);
        setAllDocs(await getAllLocalDocs());
        return;
      }

      // Per user request: always start from new doc with empty text area
      const freshDoc = await createFreshDoc();
      setCurrentDoc(freshDoc);
      setHasWriteKey(true);
      setAllDocs(await getAllLocalDocs());
    }

    initApp();
  }, []);

  // Check write key presence when currentDoc changes
  useEffect(() => {
    if (currentDoc) {
      getWriteKey(currentDoc.docId).then((key) => {
        setHasWriteKey(!!key || !!currentDoc.isDemo);
      });
      getLocalSnapshots(currentDoc.docId).then((snaps) => {
        setSnapshots(snaps);
      });
    }
  }, [currentDoc]);

  // Create a fresh empty student document
  const handleCreateNewDoc = async () => {
    const newDoc = await createFreshDoc();
    setCurrentDoc(newDoc);
    setHasWriteKey(true);
    setViewMode('write');
    setAllDocs(await getAllLocalDocs());
  };

  // Open Seeded Demo: History
  const handleOpenDemo = async (type: 'history') => {
    const { historyDoc } = await generateDemoSeeds();
    setCurrentDoc(historyDoc);
    const snaps = await getLocalSnapshots(historyDoc.docId);
    setSnapshots(snaps);
    setReplaySource('write');
    setViewMode('replay');
    setAllDocs(await getAllLocalDocs());
  };

  // Open Replay for a specific submission in Teacher's Corner
  const handleOpenReplayForDoc = async (doc: DocumentMeta) => {
    setCurrentDoc(doc);
    const snaps = await getLocalSnapshots(doc.docId);
    setSnapshots(snaps);
    setReplaySource('teachers-corner');
    setViewMode('replay');
  };

  // Open Declaration for a specific submission in Teacher's Corner
  const handleOpenDeclareForDoc = (doc: DocumentMeta) => {
    setCurrentDoc(doc);
    setShowDeclare(true);
  };

  // Open Export Modal for a specific doc
  const handleExportDoc = (doc: DocumentMeta) => {
    setCurrentDoc(doc);
    setShowExportImport(true);
  };

  // Create share link for a doc
  const handleShareDoc = async (doc: DocumentMeta) => {
    try {
      const writeKey = await getWriteKey(doc.docId);
      if (!writeKey) return;
      const res = await fetch(`/api/docs/${doc.docId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${writeKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const fullUrl = window.location.origin + data.shareUrl;
        await navigator.clipboard.writeText(fullUrl);
      }
    } catch (_) {}
  };

  const handleImportReplay = (bundle: ExportBundle) => {
    setImportedBundle(bundle);
    setViewMode('reviewer');
  };

  const handleDeclarationSaved = (decl: AIDeclaration, newVersion: number) => {
    if (currentDoc) {
      const updated = { ...currentDoc, declaration: decl, version: newVersion };
      setCurrentDoc(updated);
      saveLocalDoc(updated);
      getAllLocalDocs().then(setAllDocs);
    }
  };

  // Reviewer View
  if (viewMode === 'reviewer') {
    return (
      <ReviewerView
        docId={reviewerDocId || 'imported'}
        shareToken={reviewerToken || undefined}
        importedBundle={importedBundle}
        onBackToApp={() => {
          setReviewerToken(null);
          setReviewerDocId(null);
          setImportedBundle(null);
          setViewMode('teachers-corner');
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  // Teacher's Corner: Strictly isolated full-screen view (student workspace is inaccessible while inside)
  if (viewMode === 'teachers-corner') {
    return (
      <>
        <TeachersCornerView
          onBackToWriting={handleLockTeacherCorner}
          onOpenReplayForDoc={handleOpenReplayForDoc}
          onOpenDeclareForDoc={handleOpenDeclareForDoc}
          onExportDoc={handleExportDoc}
          onShareDoc={handleShareDoc}
          onLockTeacherCorner={handleLockTeacherCorner}
        />
        {currentDoc && (
          <ExportImportModal
            isOpen={showExportImport}
            onClose={() => setShowExportImport(false)}
            currentDoc={currentDoc}
            onImportReplay={handleImportReplay}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#101114] text-[#171923] dark:text-[#ECEEF2] flex flex-col font-sans selection:bg-emerald-500/20 transition-colors duration-180">
      {/* Top Application Navbar */}
      <header className="border-b border-[#E2E8F0] dark:border-[#292D33] bg-[#FFFFFF]/90 dark:bg-[#17191D]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm shadow-xs">
              DR
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-[#171923] dark:text-[#ECEEF2] tracking-tight">DraftReplay</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[10px] text-[#64748B] dark:text-[#9298A3] -mt-0.5">Writing Process Transparency</p>
            </div>
          </div>

          {/* Primary View Switcher: Student Workspace vs Teacher's Corner */}
          <div className="flex items-center bg-[#F1F5F9] dark:bg-[#101114] p-1 rounded-2xl border border-[#E2E8F0] dark:border-[#292D33]">
            <button
              onClick={() => setViewMode('write')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'write'
                  ? 'bg-[#FFFFFF] dark:bg-[#17191D] text-[#171923] dark:text-[#ECEEF2] shadow-xs'
                  : 'text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2]'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Student Essay</span>
            </button>

            <button
              onClick={() => {
                requireTeacherAccess(() => setViewMode('teachers-corner'));
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2]"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Teacher&apos;s Corner</span>
              {!isTeacherAuthenticated ? (
                <Lock className="w-3 h-3 text-amber-500/90" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() => setShowFeedbackTracker(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B]"
              title="Track marks, review status, and feedback for all your essays"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Track Feedback</span>
            </button>
          </div>

          {/* Quick doc & demo selector */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              onClick={handleCreateNewDoc}
              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              title="Create a fresh empty document"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>New Doc</span>
            </button>

            <button
              onClick={() => handleOpenDemo('history')}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-xs text-amber-600 dark:text-amber-300 font-medium shrink-0 cursor-pointer shadow-xs"
              title="History Essay demo with 4 pasted blocks"
            >
              Demo: History
            </button>
          </div>

          {/* Right Tools: Spec Tests, Help, and Theme Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTestHarness(true)}
              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Run Automated Spec Tests T1-T21b"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Spec Tests</span>
            </button>

            <button
              onClick={() => setShowWhatWeRecord(true)}
              className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
              title="What DraftReplay records and why"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Theme Switcher Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Write key missing banner */}
      {!hasWriteKey && currentDoc && !currentDoc.isDemo && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-3">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-600/70 rounded-2xl text-amber-900 dark:text-amber-200 text-xs md:text-sm flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">Write Key Unavailable on this Device</div>
              <p className="text-[#64748B] dark:text-zinc-300 text-xs">
                This device no longer holds the write key; server versions cannot be added.
                Your local cached copies still work.
              </p>
              <div className="pt-1 flex gap-2">
                <button
                  onClick={handleCreateNewDoc}
                  className="px-3 py-1 bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] rounded-lg text-xs font-medium cursor-pointer"
                >
                  Start Fresh Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 flex flex-col p-2 md:p-6">
        {currentDoc && viewMode === 'write' && (
          <WriteView
            currentDoc={currentDoc}
            onDocChange={(d) => setCurrentDoc(d)}
            onOpenWhatWeRecord={() => setShowWhatWeRecord(true)}
            onOpenTeachersCorner={() => requireTeacherAccess(() => setViewMode('teachers-corner'))}
            onOpenDeclare={() => setShowDeclare(true)}
            onOpenFeedbackTracker={() => setShowFeedbackTracker(true)}
            isReadOnlyDemo={!!currentDoc.isDemo}
          />
        )}

        {currentDoc && viewMode === 'replay' && (
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-[600px]">
            <ReplayPlayer
              title={currentDoc.title}
              studentId={currentDoc.studentId}
              studentClass={currentDoc.studentClass}
              snapshots={snapshots}
              declaration={currentDoc.declaration}
              isDemo={!!currentDoc.isDemo}
              onClose={() => setViewMode(replaySource)}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {currentDoc && (
        <DeclareModal
          isOpen={showDeclare}
          onClose={() => setShowDeclare(false)}
          docId={currentDoc.docId}
          initialDeclaration={currentDoc.declaration}
          onDeclarationSaved={handleDeclarationSaved}
        />
      )}

      <WhatWeRecordModal
        isOpen={showWhatWeRecord}
        onClose={() => setShowWhatWeRecord(false)}
      />

      {currentDoc && (
        <ExportImportModal
          isOpen={showExportImport}
          onClose={() => setShowExportImport(false)}
          currentDoc={currentDoc}
          onImportReplay={handleImportReplay}
        />
      )}

      <TestHarnessModal
        isOpen={showTestHarness}
        onClose={() => setShowTestHarness(false)}
      />

      <TeacherAccessModal
        isOpen={showTeacherAccessModal}
        onClose={() => {
          setShowTeacherAccessModal(false);
          setPendingTeacherAction(null);
        }}
        onSuccess={handleTeacherAccessSuccess}
        targetActionName="Teacher's Corner"
      />

      <StudentFeedbackTrackerModal
        isOpen={showFeedbackTracker}
        onClose={() => setShowFeedbackTracker(false)}
        currentStudentId={currentDoc?.studentId}
        onSelectDoc={(doc) => {
          setCurrentDoc(doc);
          setViewMode('write');
        }}
        onOpenReplay={(doc) => {
          setCurrentDoc(doc);
          setReplaySource('write');
          setViewMode('replay');
        }}
      />

      {/* Persistent Watermark per user request: Made with Momen badge */}
      <MomenWatermark variant="fixed" />
    </div>
  );
}
