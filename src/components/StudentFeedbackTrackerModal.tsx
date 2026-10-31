import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  Clock,
  Eye,
  CheckCircle2,
  FileText,
  Play,
  Sparkles,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { DocumentMeta, ReviewStatus } from '../types';
import { getAllLocalDocs } from '../lib/db';
import { formatSaveTimestamp } from '../lib/time';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentStudentId?: string;
  onSelectDoc: (doc: DocumentMeta) => void;
  onOpenReplay: (doc: DocumentMeta) => void;
}

export const StudentFeedbackTrackerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentStudentId,
  onSelectDoc,
  onOpenReplay,
}) => {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const localList = await getAllLocalDocs();

      // Attempt to sync latest grades & statuses from server
      try {
        const res = await fetch('/api/docs');
        if (res.ok) {
          const data = await res.json();
          const serverDocsMap = new Map<string, any>(data.docs.map((d: any) => [d.docId, d]));

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
            }
          }
        }
      } catch (_) {}

      // Filter to current student's docs if available, or all non-demo submissions
      const relevant = localList.filter((d) => {
        if (d.isDemo) return false;
        if (currentStudentId && d.studentId && d.studentId !== currentStudentId) return false;
        return true;
      });

      // Sort: submitted with grades first, then submitted without grades, then most recent
      relevant.sort((a, b) => {
        if (a.isSubmitted && !b.isSubmitted) return -1;
        if (!a.isSubmitted && b.isSubmitted) return 1;
        return (b.submittedAt || b.createdAt) - (a.submittedAt || a.createdAt);
      });

      setDocs(relevant);
      if (relevant.length > 0 && !selectedDocId) {
        setSelectedDocId(relevant[0].docId);
      }
    } catch (err) {
      console.error('Failed to load student feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSubmissions();
    }
  }, [isOpen, currentStudentId]);

  if (!isOpen) return null;

  const selectedDoc = docs.find((d) => d.docId === selectedDocId) || docs[0] || null;

  // Review Status formatting helper
  const getStatusDisplay = (doc: DocumentMeta) => {
    const status: ReviewStatus = doc.reviewStatus || (doc.grade ? 'reviewed' : doc.isSubmitted ? 'submitted' : 'submitted');

    switch (status) {
      case 'reviewed':
        return {
          label: 'Reviewed · Marks Ready',
          color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-500/40',
          icon: CheckCircle2,
          step: 3,
        };
      case 'under_review':
        return {
          label: 'Under Review',
          color: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-600/40',
          icon: Clock,
          step: 2,
        };
      case 'seen':
        return {
          label: 'Seen by Teacher',
          color: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/70 border-sky-300 dark:border-sky-500/40',
          icon: Eye,
          step: 1,
        };
      case 'submitted':
      default:
        return {
          label: doc.isSubmitted ? 'Submitted (Pending Review)' : 'Draft in Progress',
          color: 'text-[#64748B] dark:text-zinc-300 bg-[#F1F5F9] dark:bg-[#22252B] border-[#E2E8F0] dark:border-[#292D33]',
          icon: Clock,
          step: 0,
        };
    }
  };

  const submittedCount = docs.filter((d) => d.isSubmitted).length;
  const gradedCount = docs.filter((d) => !!d.grade).length;
  const underReviewCount = docs.filter((d) => d.isSubmitted && !d.grade).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/40 dark:bg-black/85 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div
        className="w-full max-w-4xl bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-2xl p-5 md:p-7 text-[#171923] dark:text-[#ECEEF2] relative my-auto max-h-[92vh] flex flex-col transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-tracker-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-[#E2E8F0] dark:border-[#292D33] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id="feedback-tracker-title" className="text-xl font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
                My Essay Tracking & Teacher Feedback
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#9298A3]">
                Track marks, rubric scores, teacher review status, and evaluation process notes
              </p>
            </div>
          </div>

          <button
            onClick={loadSubmissions}
            className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#14161A] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] dark:text-zinc-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="grid grid-cols-3 gap-3 mb-4 shrink-0">
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
            <div className="text-[10px] uppercase font-semibold text-[#64748B] dark:text-zinc-400">Total Submissions</div>
            <div className="text-lg font-bold text-[#171923] dark:text-[#ECEEF2] mt-0.5">{submittedCount}</div>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
            <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400">Marks Received</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{gradedCount}</div>
          </div>
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
            <div className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400">In Review Queue</div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{underReviewCount}</div>
          </div>
        </div>

        {/* Main Content: Split Master-Detail View */}
        {docs.length === 0 ? (
          <div className="p-8 text-center bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] my-4">
            <FileText className="w-10 h-10 mx-auto text-[#94A3B8] dark:text-zinc-600 mb-2" />
            <p className="text-sm font-semibold text-[#171923] dark:text-[#ECEEF2]">No Submitted Essays Yet</p>
            <p className="text-xs text-[#64748B] dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              When you complete and submit an essay, your review status and teacher feedback will be tracked right here.
            </p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-[360px]">
            {/* Left Column: Essay Submissions List */}
            <div className="md:col-span-5 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
              {docs.map((doc) => {
                const statusMeta = getStatusDisplay(doc);
                const isSelected = doc.docId === selectedDoc?.docId;
                const StatusIcon = statusMeta.icon;

                return (
                  <div
                    key={doc.docId}
                    onClick={() => setSelectedDocId(doc.docId)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500/70 shadow-xs'
                        : 'bg-[#F8FAFC] dark:bg-[#14161A] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border-[#E2E8F0] dark:border-[#292D33]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono text-[#64748B] dark:text-zinc-400">
                        {doc.submittedAt ? formatSaveTimestamp(doc.submittedAt) : 'Draft'}
                      </span>
                      {doc.grade && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                          {doc.grade.letterGrade} ({doc.grade.score})
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-[#171923] dark:text-[#ECEEF2] line-clamp-1">
                      {doc.title || 'Untitled Essay'}
                    </h4>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusMeta.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{statusMeta.label}</span>
                      </span>

                      <span className="text-[10px] text-[#94A3B8] dark:text-zinc-500 font-mono">
                        {doc.lastSeq} saves
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Detailed Feedback & Status Inspector */}
            {selectedDoc && (
              <div className="md:col-span-7 overflow-y-auto max-h-[50vh] p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Essay Heading & Status Stepper */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {selectedDoc.studentId} · {selectedDoc.studentClass || 'Standard Grade'}
                        </span>
                        <h3 className="text-base font-bold text-[#171923] dark:text-[#ECEEF2]">
                          {selectedDoc.title}
                        </h3>
                      </div>

                      {/* Marks Badge */}
                      {selectedDoc.grade ? (
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                            {selectedDoc.grade.score}
                            <span className="text-xs text-[#64748B] dark:text-zinc-400 font-normal">/100</span>
                          </div>
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            Grade: {selectedDoc.grade.letterGrade}
                          </div>
                        </div>
                      ) : (
                        <div className="text-right shrink-0">
                          <span className="text-xs text-[#94A3B8] dark:text-zinc-500 italic">Marks Pending</span>
                        </div>
                      )}
                    </div>

                    {/* Visual 4-Step Review Progress */}
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#292D33]">
                      <div className="text-[10px] uppercase font-bold text-[#64748B] dark:text-zinc-400 mb-2">
                        Review Workflow Status:
                      </div>
                      {(() => {
                        const status: ReviewStatus = selectedDoc.reviewStatus || (selectedDoc.grade ? 'reviewed' : selectedDoc.isSubmitted ? 'submitted' : 'submitted');
                        const steps = [
                          { key: 'submitted', label: '1. Submitted' },
                          { key: 'seen', label: '2. Seen' },
                          { key: 'under_review', label: '3. Under Review' },
                          { key: 'reviewed', label: '4. Reviewed & Graded' },
                        ];
                        const order = ['submitted', 'seen', 'under_review', 'reviewed'];
                        const currentIndex = order.indexOf(status);

                        return (
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            {steps.map((st, idx) => {
                              const isCompleted = idx <= currentIndex;
                              const isCurrent = idx === currentIndex;
                              return (
                                <div
                                  key={st.key}
                                  className={`py-1.5 px-1 rounded-lg border text-[10px] font-semibold transition-all ${
                                    isCurrent
                                      ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 shadow-xs'
                                      : isCompleted
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                                      : 'bg-[#FFFFFF] dark:bg-[#17191D] text-[#94A3B8] dark:text-zinc-600 border-[#E2E8F0] dark:border-[#292D33]'
                                  }`}
                                >
                                  {st.label}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Rubric Breakdown if graded */}
                  {selectedDoc.grade && (
                    <div className="p-3 bg-[#FFFFFF] dark:bg-[#17191D] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] space-y-2">
                      <div className="text-xs font-bold text-[#171923] dark:text-[#ECEEF2] flex items-center justify-between">
                        <span>Teacher&apos;s Rubric Breakdown</span>
                        <span className="text-[10px] font-mono text-[#64748B] dark:text-zinc-400">
                          {selectedDoc.grade.gradedBy} · {formatSaveTimestamp(selectedDoc.grade.gradedAt)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33]">
                          <div className="flex justify-between text-[11px] text-[#64748B] dark:text-zinc-400">
                            <span>Process Integrity</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDoc.grade.rubric.processIntegrity}/25</span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] dark:bg-[#292D33] h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full" style={{ width: `${(selectedDoc.grade.rubric.processIntegrity / 25) * 100}%` }} />
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33]">
                          <div className="flex justify-between text-[11px] text-[#64748B] dark:text-zinc-400">
                            <span>AI Disclosure</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDoc.grade.rubric.aiDisclosure}/25</span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] dark:bg-[#292D33] h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full" style={{ width: `${(selectedDoc.grade.rubric.aiDisclosure / 25) * 100}%` }} />
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33]">
                          <div className="flex justify-between text-[11px] text-[#64748B] dark:text-zinc-400">
                            <span>Writing Quality</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDoc.grade.rubric.writingQuality}/25</span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] dark:bg-[#292D33] h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full" style={{ width: `${(selectedDoc.grade.rubric.writingQuality / 25) * 100}%` }} />
                          </div>
                        </div>

                        <div className="p-2 rounded-lg bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33]">
                          <div className="flex justify-between text-[11px] text-[#64748B] dark:text-zinc-400">
                            <span>Revision Depth</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedDoc.grade.rubric.revisionDepth}/25</span>
                          </div>
                          <div className="w-full bg-[#E2E8F0] dark:bg-[#292D33] h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full" style={{ width: `${(selectedDoc.grade.rubric.revisionDepth / 25) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Teacher Comments & Explanation of Grading Process */}
                  <div className="space-y-2">
                    {/* Teacher's Explanation of the Grading Process */}
                    <div className="p-3 bg-[#FFFFFF] dark:bg-[#17191D] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#171923] dark:text-[#ECEEF2] mb-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Teacher&apos;s Grading Process & Reviewer Notes:</span>
                      </div>

                      {selectedDoc.grade?.gradingExplanation || selectedDoc.teacherComments ? (
                        <p className="text-xs text-[#171923] dark:text-zinc-200 leading-relaxed font-sans mt-1 p-2 bg-[#F8FAFC] dark:bg-[#14161A] rounded-lg border border-[#E2E8F0] dark:border-[#292D33]/60">
                          {selectedDoc.grade?.gradingExplanation || selectedDoc.teacherComments}
                        </p>
                      ) : selectedDoc.grade ? (
                        <p className="text-xs text-[#64748B] dark:text-zinc-400 italic">
                          Grading based on standard 4-tier DraftReplay integrity rubric and replay cadence.
                        </p>
                      ) : (
                        <p className="text-xs text-[#94A3B8] dark:text-zinc-500 italic">
                          The teacher has not added specific grading process notes yet. As the essay moves through Seen and Under Review, teacher notes will appear here.
                        </p>
                      )}
                    </div>

                    {/* Direct Teacher Feedback Quote */}
                    {selectedDoc.grade?.feedback && (
                      <div className="p-3 bg-[#FFFFFF] dark:bg-[#17191D] rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#171923] dark:text-[#ECEEF2] mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Teacher&apos;s Feedback on Your Essay:</span>
                        </div>
                        <p className="text-xs text-[#171923] dark:text-zinc-200 italic whitespace-pre-line leading-relaxed">
                          &quot;{selectedDoc.grade.feedback}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions for Selected Essay */}
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#292D33] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onOpenReplay(selectedDoc);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Watch Writing Replay</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectDoc(selectedDoc);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open in Editor</span>
                    </button>
                  </div>

                  <span className="text-[10px] font-mono text-[#94A3B8] dark:text-zinc-500">
                    Doc ID: {selectedDoc.docId.slice(0, 8)}...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer with Watermark */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#292D33] flex items-center justify-between shrink-0">
          <MomenWatermark variant="inline" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
