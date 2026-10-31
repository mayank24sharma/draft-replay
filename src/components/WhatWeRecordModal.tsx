import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatWeRecordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="what-we-record-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 id="what-we-record-title" className="text-xl font-semibold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              What DraftReplay records and why
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Transparency principles & data truth</p>
          </div>
        </div>

        {/* Verbatim copy of the note per spec */}
        <div className="bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl p-5 text-sm md:text-base leading-relaxed text-[#64748B] dark:text-zinc-300 font-sans space-y-4">
          <p>
            We record snapshots — the full document at moments of change — never keystrokes: we
            show effort, not surveillance. Paste lengths come from the clipboard and are exact;
            other counts are estimates. We keep no separate record of deleted text; earlier
            snapshots still show what the document said before. No names, no accounts. A document
            carries a random ID — not anonymity: the text can identify its author. Versions are
            stored on our server under that ID. Anyone with the write key can add versions; losing
            it stops server writes — no recovery — clearing this device&apos;s site data removes
            the local copy. The key holder can delete the document and its versions; nothing is
            deleted automatically. A reviewer sees a replay only when you share it; imported
            replays are labelled &quot;not independently verified&quot;. Your declaration is self-reported.
            The rate limiter reads your IP in memory only — never saved.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <MomenWatermark variant="inline" />
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-zinc-200 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
