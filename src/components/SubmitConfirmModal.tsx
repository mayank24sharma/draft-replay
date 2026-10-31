import React from 'react';
import { X, Send, AlertTriangle, Lock } from 'lucide-react';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  studentId?: string;
  studentClass: string;
  essayTitle: string;
  charCount: number;
  hasDeclaration?: boolean;
  isSubmitting?: boolean;
}

export const SubmitConfirmModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  studentId,
  studentClass,
  essayTitle,
  charCount,
  hasDeclaration = false,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 id="submit-modal-title" className="text-xl font-semibold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Submit Essay to Teacher?
            </h2>
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Final submission — changes will be locked</p>
          </div>
        </div>

        {/* Warning prompt per user request */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-600/50 rounded-xl text-xs md:text-sm text-[#171923] dark:text-zinc-300 space-y-2 mb-5">
          <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Do you want to submit your essay?</span>
          </p>
          <p className="leading-relaxed text-[#64748B] dark:text-zinc-300">
            After submission, <strong>no further changes will be applied</strong>. Your document will be permanently locked and sent to the <strong>Teacher&apos;s Corner</strong> for review.
          </p>
        </div>

        {/* Submission Details Summary */}
        <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl text-xs space-y-1.5 mb-6">
          <div className="flex justify-between text-[#64748B] dark:text-zinc-400">
            <span>Student ID:</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{studentId || 'STU-2026-0001'}</span>
          </div>
          <div className="flex justify-between text-[#64748B] dark:text-zinc-400">
            <span>Class / Grade:</span>
            <span className="font-semibold text-[#171923] dark:text-zinc-100">{studentClass || 'Not specified'}</span>
          </div>
          <div className="flex justify-between text-[#64748B] dark:text-zinc-400">
            <span>Essay Title:</span>
            <span className="font-semibold text-[#171923] dark:text-zinc-100 truncate max-w-[220px]">{essayTitle || 'Untitled'}</span>
          </div>
          <div className="flex justify-between text-[#64748B] dark:text-zinc-400">
            <span>AI Declaration:</span>
            <span className={`font-semibold ${hasDeclaration ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {hasDeclaration ? 'Included & Certified' : 'None (Independent writing)'}
            </span>
          </div>
          <div className="flex justify-between text-[#64748B] dark:text-zinc-400">
            <span>Length:</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{charCount} characters</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <MomenWatermark variant="inline" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-medium text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] rounded-xl transition-colors cursor-pointer"
            >
              Cancel & Keep Editing
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Yes, Submit & Lock Essay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
