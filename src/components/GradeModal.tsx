import React, { useState } from 'react';
import {
  X,
  Award,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Shield,
} from 'lucide-react';
import { DocumentMeta, GradeRecord, LetterGrade, GradeRubric, ReviewStatus } from '../types';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doc: DocumentMeta;
  onGradeSaved: (updatedDoc: DocumentMeta) => void;
}

export const GradeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  doc,
  onGradeSaved,
}) => {
  const initialGrade = doc.grade;

  const [rubric, setRubric] = useState<GradeRubric>({
    processIntegrity: initialGrade?.rubric?.processIntegrity ?? 23,
    aiDisclosure: initialGrade?.rubric?.aiDisclosure ?? 24,
    writingQuality: initialGrade?.rubric?.writingQuality ?? 22,
    revisionDepth: initialGrade?.rubric?.revisionDepth ?? 21,
  });

  const [feedback, setFeedback] = useState<string>(initialGrade?.feedback || '');
  const [gradingExplanation, setGradingExplanation] = useState<string>(
    initialGrade?.gradingExplanation || doc.teacherComments || ''
  );
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(
    doc.reviewStatus || 'reviewed'
  );
  const [teacherName, setTeacherName] = useState<string>(initialGrade?.gradedBy || 'Teacher');
  const [status, setStatus] = useState<'graded' | 'needs-revision'>(initialGrade?.status || 'graded');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute total score (0 - 100)
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      rubric.processIntegrity + rubric.aiDisclosure + rubric.writingQuality + rubric.revisionDepth
    )
  );

  // Calculate letter grade
  const calculateLetter = (s: number): LetterGrade => {
    if (s >= 95) return 'A+';
    if (s >= 90) return 'A';
    if (s >= 85) return 'A-';
    if (s >= 80) return 'B+';
    if (s >= 75) return 'B';
    if (s >= 70) return 'B-';
    if (s >= 65) return 'C+';
    if (s >= 55) return 'C';
    if (s >= 45) return 'D';
    return 'F';
  };

  const letterGrade = calculateLetter(totalScore);

  const handleRubricChange = (field: keyof GradeRubric, value: number) => {
    const clamped = Math.min(25, Math.max(0, value));
    setRubric((prev) => ({ ...prev, [field]: clamped }));
  };

  const FEEDBACK_PRESETS = [
    '✨ Excellent drafting discipline and organic writing progression.',
    '🔍 Transparent and honest AI disclosure — exactly what DraftReplay supports.',
    '📝 Strong vocabulary, clear paragraph structure, and compelling voice.',
    '💡 Consider revising conclusion paragraphs with deeper independent reflection.',
    '⚠️ Multiple large block pastes detected without clear draft iteration.',
  ];

  const EXPLANATION_PRESETS = [
    'Replay verified: organic human drafting cadence with authentic pauses.',
    'AI disclosure matched paste audit: ideation used transparently without full text dumping.',
    'Revision depth confirmed: student iteratively revised sentences across multiple passes.',
    'Draft timeline shows independent composition from clean document start.',
  ];

  const handleAddFeedback = (preset: string) => {
    if (!feedback.trim()) {
      setFeedback(preset);
    } else if (!feedback.includes(preset)) {
      setFeedback((prev) => `${prev.trim()}\n• ${preset}`);
    }
  };

  const handleAddExplanation = (preset: string) => {
    if (!gradingExplanation.trim()) {
      setGradingExplanation(preset);
    } else if (!gradingExplanation.includes(preset)) {
      setGradingExplanation((prev) => `${prev.trim()} ${preset}`);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const gradePayload: GradeRecord = {
      score: totalScore,
      letterGrade,
      rubric,
      feedback: feedback.trim(),
      gradingExplanation: gradingExplanation.trim(),
      gradedAt: Date.now(),
      gradedBy: teacherName.trim() || 'Teacher',
      status,
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await fetch(`/api/docs/${doc.docId}/grade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...gradePayload,
            reviewStatus,
          }),
        }).catch(() => {});
      }

      const updatedDoc: DocumentMeta = {
        ...doc,
        grade: gradePayload,
        reviewStatus,
        reviewStatusUpdatedAt: Date.now(),
        teacherComments: gradingExplanation.trim() || doc.teacherComments,
      };

      onGradeSaved(updatedDoc);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save marks');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/40 dark:bg-black/85 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-2xl p-5 md:p-7 text-[#171923] dark:text-[#ECEEF2] relative my-auto max-h-[92vh] flex flex-col transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grading-modal-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 id="grading-modal-title" className="text-xl font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Teacher&apos;s Corner · Essay Evaluation & Marking
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">
              Score writing process integrity, AI transparency, and essay quality
            </p>
          </div>
        </div>

        {/* Student & Document Summary Card */}
        <div className="mb-4 p-3 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs shrink-0">
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Student ID</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{doc.studentId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Class / Grade</span>
            <span className="text-[#171923] dark:text-zinc-200 font-semibold">{doc.studentClass || 'Not set'}</span>
          </div>
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Essay Title</span>
            <span className="text-[#171923] dark:text-zinc-200 font-semibold truncate block">{doc.title || 'Untitled'}</span>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs rounded-xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveGrade} className="space-y-4 overflow-y-auto pr-1">
          {/* Total Marks Scoreboard */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-[#F8FAFC] to-[#F8FAFC] dark:from-emerald-950/40 dark:via-[#14161A] dark:to-[#14161A] border border-emerald-300 dark:border-emerald-500/40 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                Overall Score & Grade
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {totalScore}
                </span>
                <span className="text-xs text-[#64748B] dark:text-zinc-400 font-medium">/ 100 points</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#94A3B8] dark:text-zinc-500 block font-semibold">Awarded</span>
                <span className="text-2xl font-black text-[#171923] dark:text-zinc-100">{letterGrade}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/50 flex items-center justify-center text-xl font-black text-emerald-700 dark:text-emerald-300">
                {letterGrade}
              </div>
            </div>
          </div>

          {/* 4 Rubric Sliders (25 pts each = 100 total) */}
          <div className="space-y-3 bg-[#F8FAFC] dark:bg-[#14161A] p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#292D33]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-zinc-400 flex items-center gap-1.5">
              <span>Evaluation Rubric (4 Pillars · 25 pts each)</span>
            </h4>

            {/* Rubric item 1 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#171923] dark:text-zinc-200">1. Writing Process Integrity</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{rubric.processIntegrity} / 25</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={rubric.processIntegrity}
                onChange={(e) => handleRubricChange('processIntegrity', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 dark:accent-emerald-500 bg-[#E2E8F0] dark:bg-zinc-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500">Continuous typing, natural drafting pauses, minimal unverified block pastes.</p>
            </div>

            {/* Rubric item 2 */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#171923] dark:text-zinc-200">2. AI Transparency & Declaration Honesty</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{rubric.aiDisclosure} / 25</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={rubric.aiDisclosure}
                onChange={(e) => handleRubricChange('aiDisclosure', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 dark:accent-emerald-500 bg-[#E2E8F0] dark:bg-zinc-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500">Student certified their AI assistance level with an accurate reflection note.</p>
            </div>

            {/* Rubric item 3 */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#171923] dark:text-zinc-200">3. Writing Quality & Structure</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{rubric.writingQuality} / 25</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={rubric.writingQuality}
                onChange={(e) => handleRubricChange('writingQuality', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 dark:accent-emerald-500 bg-[#E2E8F0] dark:bg-zinc-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500">Grammar, vocabulary, coherence, argumentative structure, and topic mastery.</p>
            </div>

            {/* Rubric item 4 */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#171923] dark:text-zinc-200">4. Revision Depth & Self-Correction</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{rubric.revisionDepth} / 25</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={rubric.revisionDepth}
                onChange={(e) => handleRubricChange('revisionDepth', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 dark:accent-emerald-500 bg-[#E2E8F0] dark:bg-zinc-800 h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500">Iterative changes, active rewrites, deletion refinement, and final polish.</p>
            </div>
          </div>

          {/* Teacher Remarks & Constructive Feedback */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="teacher-feedback" className="text-xs font-semibold text-[#171923] dark:text-zinc-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Teacher Remarks & Constructive Feedback</span>
              </label>
            </div>
            <textarea
              id="teacher-feedback"
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write feedback for the student on their drafting habits, argument strength, or revision..."
              className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl p-3 text-xs md:text-sm text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden resize-none"
            />

            {/* Quick preset chips */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FEEDBACK_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddFeedback(p)}
                  className="px-2.5 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] rounded-lg text-[11px] text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  {p.slice(0, 36)}...
                </button>
              ))}
            </div>
          </div>

          {/* Teacher's Explanation of the Grading Process (User Request) */}
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] space-y-1.5">
            <label htmlFor="grading-explanation" className="text-xs font-semibold text-[#171923] dark:text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Grading Process Explanation (Visible to Student)</span>
            </label>
            <p className="text-[11px] text-[#64748B] dark:text-[#9298A3]">
              Explain how you evaluated the essay (e.g., replay cadence, revision depth, AI declaration audit).
            </p>
            <textarea
              id="grading-explanation"
              rows={2}
              value={gradingExplanation}
              onChange={(e) => setGradingExplanation(e.target.value)}
              placeholder="e.g. Replay verified: continuous human typing progression observed; AI brainstorming aligned with student declaration..."
              className="w-full bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl p-2.5 text-xs text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden resize-none"
            />
            {/* Explanation Presets */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {EXPLANATION_PRESETS.map((ep, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddExplanation(ep)}
                  className="px-2 py-0.5 bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] rounded-md text-[10px] text-[#64748B] hover:text-[#171923] dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {ep.slice(0, 38)}...
                </button>
              ))}
            </div>
          </div>

          {/* Grader Name, Review Status & Evaluation Decision */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div>
              <label htmlFor="teacher-name" className="block text-xs font-semibold text-[#171923] dark:text-zinc-300 mb-1">
                Graded By
              </label>
              <input
                id="teacher-name"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="e.g. Teacher"
                className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-[#171923] dark:text-[#ECEEF2] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171923] dark:text-zinc-300 mb-1">
                Review Status (Workflow)
              </label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as any)}
                className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-[#171923] dark:text-[#ECEEF2] outline-hidden cursor-pointer"
              >
                <option value="seen">Seen · Acknowledged</option>
                <option value="under_review">Under Review · In Progress</option>
                <option value="reviewed">Reviewed · Finalized</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171923] dark:text-zinc-300 mb-1">
                Marks Decision
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-[#171923] dark:text-[#ECEEF2] outline-hidden cursor-pointer"
              >
                <option value="graded">Graded · Marks Approved</option>
                <option value="needs-revision">Needs Revision · Resubmit</option>
              </select>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#292D33] flex items-center justify-between shrink-0">
            <MomenWatermark variant="inline" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving Marks...' : 'Save & Publish Marks'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
