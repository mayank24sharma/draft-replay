import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Play,
  Sparkles,
  Share2,
  Download,
  Lock,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  FileText,
  RefreshCw,
  Award,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { DocumentMeta, ReviewStatus } from '../types';
import { getAllLocalDocs, saveLocalDoc } from '../lib/db';
import { formatSaveTimestamp } from '../lib/time';
import { GradeModal } from './GradeModal';
import { StudentDeclarationModal } from './StudentDeclarationModal';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  onBackToWriting: () => void;
  onOpenReplayForDoc: (doc: DocumentMeta) => void;
  onOpenDeclareForDoc?: (doc: DocumentMeta) => void;
  onExportDoc: (doc: DocumentMeta) => void;
  onShareDoc: (doc: DocumentMeta) => void;
  onLockTeacherCorner: () => void;
}

export const TeachersCornerView: React.FC<Props> = ({
  onOpenReplayForDoc,
  onExportDoc,
  onShareDoc,
  onLockTeacherCorner,
}) => {
  const [submissions, setSubmissions] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'seen' | 'under_review' | 'reviewed' | 'graded' | 'pending-grade'>('all');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modals for Teacher Grading and Viewing Student Declaration
  const [gradingDoc, setGradingDoc] = useState<DocumentMeta | null>(null);
  const [declarationDoc, setDeclarationDoc] = useState<DocumentMeta | null>(null);

  useEffect(() => {
    async function loadSubmissions() {
      setLoading(true);
      try {
        // Fetch from local store first
        const localList = await getAllLocalDocs();

        // Also attempt to fetch from server
        try {
          const res = await fetch('/api/docs');
          if (res.ok) {
            const data = await res.json();
            const serverDocsMap = new Map<string, any>(data.docs.map((d: any) => [d.docId, d]));

            // Merge local and server statuses
            for (const doc of localList) {
              const serverDoc = serverDocsMap.get(doc.docId);
              if (serverDoc) {
                if (serverDoc.isSubmitted) doc.isSubmitted = true;
                if (serverDoc.submittedAt) doc.submittedAt = serverDoc.submittedAt;
                if (serverDoc.declaration) doc.declaration = serverDoc.declaration;
                if (serverDoc.grade) doc.grade = serverDoc.grade;
                if (serverDoc.reviewStatus) doc.reviewStatus = serverDoc.reviewStatus;
                if (serverDoc.reviewStatusUpdatedAt) doc.reviewStatusUpdatedAt = serverDoc.reviewStatusUpdatedAt;
                if (serverDoc.teacherComments) doc.teacherComments = serverDoc.teacherComments;
                if (serverDoc.studentId && !doc.studentId) doc.studentId = serverDoc.studentId;
              }
            }
          }
        } catch (_) {}

        // Ensure every doc has a valid studentId
        for (const doc of localList) {
          if (!doc.studentId) {
            doc.studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }

        // Sort: Submitted first, then by date descending
        localList.sort((a, b) => {
          if (a.isSubmitted && !b.isSubmitted) return -1;
          if (!a.isSubmitted && b.isSubmitted) return 1;
          return (b.submittedAt || b.createdAt) - (a.submittedAt || a.createdAt);
        });

        setSubmissions(localList);
      } catch (err) {
        console.error('Failed to load submissions:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSubmissions();
  }, [refreshKey]);

  const handleGradeSaved = async (updatedDoc: DocumentMeta) => {
    await saveLocalDoc(updatedDoc);
    setSubmissions((prev) =>
      prev.map((d) => (d.docId === updatedDoc.docId ? updatedDoc : d))
    );
  };

  const handleUpdateReviewStatus = async (doc: DocumentMeta, newStatus: ReviewStatus) => {
    const updated: DocumentMeta = {
      ...doc,
      reviewStatus: newStatus,
      reviewStatusUpdatedAt: Date.now(),
    };
    await saveLocalDoc(updated);
    setSubmissions((prev) => prev.map((d) => (d.docId === doc.docId ? updated : d)));

    try {
      await fetch(`/api/docs/${doc.docId}/review-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (_) {}
  };

  const handleOpenReplay = async (doc: DocumentMeta) => {
    // If essay is submitted and still in initial status, auto-update to 'under_review'
    if (doc.isSubmitted && (!doc.reviewStatus || doc.reviewStatus === 'submitted')) {
      await handleUpdateReviewStatus(doc, 'under_review');
    }
    onOpenReplayForDoc(doc);
  };

  // Extract unique classes for filtering
  const availableClasses = Array.from(
    new Set(submissions.map((s) => s.studentClass).filter(Boolean))
  ) as string[];

  // Filtered submissions
  const filteredSubmissions = submissions.filter((doc) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      doc.title.toLowerCase().includes(query) ||
      (doc.studentClass && doc.studentClass.toLowerCase().includes(query)) ||
      (doc.studentId && doc.studentId.toLowerCase().includes(query));

    const matchesClass = filterClass === 'all' || doc.studentClass === filterClass;

    const currentStatus = doc.reviewStatus || (doc.grade ? 'reviewed' : doc.isSubmitted ? 'submitted' : 'submitted');

    let matchesStatus = true;
    if (filterStatus === 'submitted') matchesStatus = !!doc.isSubmitted;
    if (filterStatus === 'seen') matchesStatus = currentStatus === 'seen';
    if (filterStatus === 'under_review') matchesStatus = currentStatus === 'under_review';
    if (filterStatus === 'reviewed') matchesStatus = currentStatus === 'reviewed';
    if (filterStatus === 'graded') matchesStatus = !!doc.grade;
    if (filterStatus === 'pending-grade') matchesStatus = !!doc.isSubmitted && !doc.grade;

    return matchesSearch && matchesClass && matchesStatus;
  });

  const submittedCount = submissions.filter((s) => s.isSubmitted).length;
  const gradedCount = submissions.filter((s) => !!s.grade).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#101114] text-[#171923] dark:text-[#ECEEF2] flex flex-col p-4 md:p-8 font-sans selection:bg-emerald-500/20 transition-colors duration-180">
      {/* Top Teacher Bar */}
      <div className="max-w-6xl w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0] dark:border-[#292D33]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Teacher&apos;s Corner · Private
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#9298A3] font-mono">
                {submittedCount} Submitted · {gradedCount} Graded · {submissions.length} Total
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#171923] dark:text-[#ECEEF2] tracking-tight mt-1">
              Classroom Essay Submissions, Marking & Replay Hub
            </h1>
          </div>
        </div>

        {/* Teacher Controls: Theme Switcher, Refresh & Secure Lock */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2.5 bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
            title="Refresh submissions from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Secure lock & exit to student corner */}
          <button
            onClick={onLockTeacherCorner}
            className="px-4 py-2 bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-red-50 dark:hover:bg-red-950/60 border border-amber-300 dark:border-amber-600/50 hover:border-red-300 dark:hover:border-red-500/60 text-amber-800 dark:text-amber-300 hover:text-red-700 dark:hover:text-red-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            title="Lock Teacher's Corner and return to Student Corner"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Lock & Exit to Student Corner</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto space-y-6 flex-1">
        {/* Search & Filters */}
        <div className="p-4 bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student ID, class, or title..."
              className="w-full bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs md:text-sm text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748B] dark:text-[#9298A3]">Filter:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl px-3 py-1.5 text-xs text-[#171923] dark:text-[#ECEEF2] outline-hidden cursor-pointer"
              >
                <option value="all">All Submissions</option>
                <option value="submitted">Submitted Only</option>
                <option value="seen">Seen by Teacher</option>
                <option value="under_review">Under Review</option>
                <option value="reviewed">Reviewed & Graded</option>
                <option value="pending-grade">Awaiting Marks</option>
              </select>
            </div>

            {/* Class filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748B] dark:text-[#9298A3] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Class:</span>
              </span>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl px-3 py-1.5 text-xs text-[#171923] dark:text-[#ECEEF2] outline-hidden cursor-pointer"
              >
                <option value="all">All Classes</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-[#64748B] dark:text-[#9298A3]">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400 mb-3" />
            <p className="text-sm">Loading classroom submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-16 p-6 bg-[#FFFFFF] dark:bg-[#17191D]/40 border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl text-center space-y-3 shadow-xs">
            <FileText className="w-10 h-10 text-[#94A3B8] dark:text-zinc-600 mx-auto" />
            <h3 className="text-lg font-semibold text-[#171923] dark:text-zinc-300">No Submissions Found</h3>
            <p className="text-xs text-[#64748B] dark:text-zinc-500 max-w-md mx-auto">
              {searchQuery
                ? 'No student submissions matched your search query.'
                : 'No essays have been submitted yet. When students click "Submit Essay" in their workspace, their locked essays will appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubmissions.map((doc) => {
              const isSubmitted = !!doc.isSubmitted;
              const hasDeclaration = !!doc.declaration;
              const grade = doc.grade;
              const reviewStatus: ReviewStatus = doc.reviewStatus || (doc.grade ? 'reviewed' : doc.isSubmitted ? 'submitted' : 'submitted');

              return (
                <div
                  key={doc.docId}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 bg-[#FFFFFF] dark:bg-[#17191D] border-[#E2E8F0] dark:border-[#292D33] shadow-xs hover:border-emerald-500/50 ${
                    !isSubmitted ? 'opacity-90' : ''
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Status, Class & Student ID */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Student ID badge */}
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold">
                          {doc.studentId || 'STU-2026-0001'}
                        </span>

                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F1F5F9] dark:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-zinc-300 font-medium">
                          {doc.studentClass || 'No Class'}
                        </span>

                        {doc.isDemo && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-600/40 text-amber-800 dark:text-amber-300">
                            Demo
                          </span>
                        )}
                      </div>

                      {/* Interactive Review Status Indicator / Quick Switcher */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-zinc-500">Status:</span>
                        <select
                          value={reviewStatus}
                          onChange={(e) => handleUpdateReviewStatus(doc, e.target.value as ReviewStatus)}
                          className={`text-xs px-2 py-1 rounded-lg font-semibold border transition-colors outline-hidden cursor-pointer ${
                            reviewStatus === 'reviewed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                              : reviewStatus === 'under_review'
                              ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300'
                              : reviewStatus === 'seen'
                              ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-300 dark:border-sky-500/50 text-sky-800 dark:text-sky-300'
                              : 'bg-[#F1F5F9] dark:bg-[#22252B] border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-zinc-300'
                          }`}
                        >
                          <option value="submitted">Submitted</option>
                          <option value="seen">Seen</option>
                          <option value="under_review">Under Review</option>
                          <option value="reviewed">Reviewed</option>
                        </select>
                      </div>
                    </div>

                    {/* Essay Title */}
                    <div>
                      <h3 className="text-lg font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight line-clamp-1">
                        {doc.title || 'Untitled Document'}
                      </h3>
                    </div>

                    {/* Stats & Timestamps */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs text-[#64748B] dark:text-[#9298A3] font-mono">
                      <div>
                        <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase">Saves Recorded</span>
                        <span className="text-[#171923] dark:text-zinc-200 font-semibold">{doc.lastSeq} snapshots</span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase">Submitted At</span>
                        <span className="text-[#171923] dark:text-zinc-200 font-semibold">
                          {doc.submittedAt ? formatSaveTimestamp(doc.submittedAt) : 'In Progress'}
                        </span>
                      </div>
                    </div>

                    {/* TEACHER MARKING / EVALUATION STATUS CARD */}
                    <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-semibold text-[#171923] dark:text-[#ECEEF2]">
                            Teacher Evaluation & Marking:
                          </span>
                        </div>

                        {grade ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                grade.status === 'graded'
                                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                                  : 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                              }`}
                            >
                              {grade.status === 'graded' ? 'Graded' : 'Needs Revision'}
                            </span>
                            <div className="flex items-center gap-1 font-mono font-bold text-xs bg-[#FFFFFF] dark:bg-[#17191D] px-2 py-0.5 rounded-lg border border-[#E2E8F0] dark:border-[#292D33] text-emerald-600 dark:text-emerald-400">
                              <span className="text-emerald-700 dark:text-emerald-300">{grade.letterGrade}</span>
                              <span className="text-[#64748B] dark:text-zinc-400">({grade.score}/100)</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#94A3B8] dark:text-zinc-500 italic">Not Marked Yet</span>
                        )}
                      </div>

                      {/* Teacher's Process Explanation (User Request) */}
                      {(grade?.gradingExplanation || doc.teacherComments) && (
                        <div className="text-[11px] text-[#171923] dark:text-zinc-200 p-2 bg-[#FFFFFF] dark:bg-[#17191D] rounded-lg border border-[#E2E8F0] dark:border-[#292D33]">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase">
                            Grading Process Explanation:
                          </span>
                          <span className="italic">{grade?.gradingExplanation || doc.teacherComments}</span>
                        </div>
                      )}

                      {grade?.feedback && (
                        <p className="text-[11px] text-[#64748B] dark:text-[#9298A3] italic border-t border-[#E2E8F0] dark:border-[#292D33] pt-1.5">
                          &quot;{grade.feedback}&quot;
                        </p>
                      )}
                    </div>

                    {/* Student AI Declaration Status */}
                    <div className="p-2.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[#64748B] dark:text-[#9298A3] font-semibold text-[11px]">
                          Student AI Declaration:
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            hasDeclaration ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#94A3B8] dark:text-zinc-500 italic'
                          }`}
                        >
                          {hasDeclaration
                            ? doc.declaration?.level === 'none'
                              ? 'No AI Used'
                              : doc.declaration?.level === 'ideas'
                              ? 'AI for Ideas'
                              : doc.declaration?.level === 'drafted'
                              ? 'AI Helped Draft'
                              : 'AI Wrote Parts'
                            : 'Pending Student Declaration'}
                        </span>
                      </div>

                      {hasDeclaration && (
                        <button
                          onClick={() => setDeclarationDoc(doc)}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <span>View Details</span>
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Teacher Actions Bar */}
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#292D33] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Open Replay (1s speed) */}
                      <button
                        onClick={() => handleOpenReplay(doc)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Replay (1s)</span>
                      </button>

                      {/* Grade / Mark Essay Button */}
                      <button
                        onClick={() => setGradingDoc(doc)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                          grade
                            ? 'bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] text-emerald-700 dark:text-emerald-300 border-[#E2E8F0] dark:border-[#292D33]'
                            : 'bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{grade ? 'Edit Marks' : 'Mark / Grade Essay'}</span>
                      </button>

                      {/* View Student Declaration Details */}
                      <button
                        onClick={() => setDeclarationDoc(doc)}
                        className="px-2.5 py-1.5 bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] text-[#64748B] dark:text-zinc-300 hover:text-[#171923] dark:hover:text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border border-[#E2E8F0] dark:border-[#292D33]"
                        title="View student's self-declaration"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Declaration</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Share link */}
                      <button
                        onClick={() => onShareDoc(doc)}
                        className="p-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
                        title="Generate reviewer link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Export bundle */}
                      <button
                        onClick={() => onExportDoc(doc)}
                        className="p-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
                        title="Export JSON bundle"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grade / Marking Modal */}
      {gradingDoc && (
        <GradeModal
          isOpen={!!gradingDoc}
          onClose={() => setGradingDoc(null)}
          doc={gradingDoc}
          onGradeSaved={handleGradeSaved}
        />
      )}

      {/* Student Declaration View Modal */}
      {declarationDoc && (
        <StudentDeclarationModal
          isOpen={!!declarationDoc}
          onClose={() => setDeclarationDoc(null)}
          doc={declarationDoc}
        />
      )}
    </div>
  );
};
