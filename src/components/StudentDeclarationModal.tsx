import React from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';
import { DocumentMeta } from '../types';
import { formatSaveTimestamp } from '../lib/time';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doc: DocumentMeta;
}

export const StudentDeclarationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  doc,
}) => {
  if (!isOpen) return null;

  const decl = doc.declaration;

  const LEVEL_LABELS: Record<string, { label: string; desc: string }> = {
    none: {
      label: 'No AI Help',
      desc: 'Student affirmed writing everything independently without AI prompting or text generation.',
    },
    ideas: {
      label: 'AI for Ideas / Brainstorming Only',
      desc: 'Used AI for outlining, topic prompts, or brainstorming structure, then drafted manually.',
    },
    drafted: {
      label: 'AI Helped Draft Some Text',
      desc: 'Generated raw sentences or paragraphs with AI and heavily edited/revised them.',
    },
    'wrote-parts': {
      label: 'AI Wrote Parts of This Essay',
      desc: 'Included AI-composed passages or synthesized blocks directly in the submission.',
    },
  };

  const currentLevelInfo = decl?.level ? LEVEL_LABELS[decl.level] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-declaration-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 id="student-declaration-title" className="text-xl font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Student&apos;s AI Use Declaration
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Author self-disclosure record</p>
          </div>
        </div>

        {/* Student metadata badge */}
        <div className="mb-5 p-3.5 bg-[#F8FAFC] dark:bg-[#14161A] rounded-xl border border-[#E2E8F0] dark:border-[#292D33] grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Student ID</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{doc.studentId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Class / Grade</span>
            <span className="text-[#171923] dark:text-zinc-200 font-semibold">{doc.studentClass || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[#94A3B8] dark:text-zinc-500 block text-[10px] uppercase font-semibold">Declared At</span>
            <span className="text-[#171923] dark:text-zinc-200 font-semibold">
              {decl?.declaredAt ? formatSaveTimestamp(decl.declaredAt) : 'Not recorded'}
            </span>
          </div>
        </div>

        {/* Declaration content */}
        {decl ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/40 rounded-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  {currentLevelInfo?.label || decl.level}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-zinc-300">
                {currentLevelInfo?.desc || 'Declared assistance level'}
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#64748B] dark:text-[#9298A3] uppercase tracking-wider mb-1.5">
                Student&apos;s Note (Tools, Prompts & Extent):
              </span>
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl text-sm text-[#171923] dark:text-zinc-200 italic min-h-[60px]">
                {decl.note ? `"${decl.note}"` : <span className="text-[#94A3B8] dark:text-zinc-500 not-italic">No additional notes provided.</span>}
              </div>
            </div>

            <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500 italic text-center">
              This declaration was authored directly by the student in their workspace.
            </p>
          </div>
        ) : (
          <div className="p-6 bg-[#F8FAFC] dark:bg-[#14161A]/50 rounded-xl border border-[#E2E8F0] dark:border-[#292D33] text-center space-y-2">
            <p className="text-sm text-[#64748B] dark:text-zinc-400 font-medium">No declaration submitted by student yet.</p>
            <p className="text-xs text-[#94A3B8] dark:text-zinc-600">
              The student has not certified their AI assistance level for this essay.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <MomenWatermark variant="inline" />
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
