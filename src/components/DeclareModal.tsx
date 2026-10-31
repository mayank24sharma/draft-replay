import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { AILevel, AIDeclaration } from '../types';
import { getWriteKey, saveLocalDoc, getLocalDoc } from '../lib/db';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  initialDeclaration: AIDeclaration | null;
  onDeclarationSaved: (decl: AIDeclaration, newVersion: number) => void;
}

const AI_OPTIONS: Array<{ level: AILevel; label: string; desc: string }> = [
  {
    level: 'none',
    label: 'No AI help',
    desc: 'Wrote everything independently without AI prompting or generation.',
  },
  {
    level: 'ideas',
    label: 'AI for ideas only (brainstorm, structure)',
    desc: 'Used AI for outlining, topic prompts, or brainstorming concepts.',
  },
  {
    level: 'drafted',
    label: 'AI helped draft some text',
    desc: 'Generated raw sentences or paragraphs with AI and revised them.',
  },
  {
    level: 'wrote-parts',
    label: 'AI wrote parts of this',
    desc: 'Included AI-composed sections directly in the submission.',
  },
];

export const DeclareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  docId,
  initialDeclaration,
  onDeclarationSaved,
}) => {
  const [level, setLevel] = useState<AILevel>(initialDeclaration?.level || 'ideas');
  const [note, setNote] = useState<string>(initialDeclaration?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const trimmedNote = note.trim().slice(0, 140);
    const declaredAt = Date.now();
    const declPayload: AIDeclaration = { level, note: trimmedNote, declaredAt };

    try {
      const writeKey = await getWriteKey(docId);
      let newVersion = 2;

      const localDoc = await getLocalDoc(docId);
      if (localDoc) {
        newVersion = localDoc.version + 1;
        localDoc.declaration = declPayload;
        localDoc.version = newVersion;
        await saveLocalDoc(localDoc);
      }

      if (writeKey && typeof navigator !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/docs/${docId}/declaration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${writeKey}`,
          },
          body: JSON.stringify(declPayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.version) newVersion = data.version;
        }
      }

      onDeclarationSaved(declPayload, newVersion);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save declaration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="declare-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 id="declare-title" className="text-xl font-semibold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Self-Declaration of AI Assistance
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Accompanies document growth history</p>
          </div>
        </div>

        {/* Prompt question */}
        <div className="mb-5 bg-[#F8FAFC] dark:bg-[#14161A] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
          <p className="text-sm md:text-base font-medium text-emerald-800 dark:text-emerald-300">
            Did you use AI help while writing this?
          </p>
          <p className="text-xs text-[#64748B] dark:text-zinc-400 mt-1">
            This is not a test — honest answers are the point.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2.5">
            {AI_OPTIONS.map((opt) => (
              <label
                key={opt.level}
                className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  level === opt.level
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/60 shadow-xs'
                    : 'bg-[#F8FAFC] dark:bg-[#14161A] border-[#E2E8F0] dark:border-[#292D33] hover:border-[#CBD5E1] dark:hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="ai-level"
                  value={opt.level}
                  checked={level === opt.level}
                  onChange={() => setLevel(opt.level)}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 dark:accent-emerald-500"
                />
                <div>
                  <div className="text-sm font-semibold text-[#171923] dark:text-zinc-200">{opt.label}</div>
                  <div className="text-xs text-[#64748B] dark:text-zinc-400 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="declare-note" className="text-xs font-medium text-[#171923] dark:text-zinc-300">
                Optional note (what tools or prompts were used)
              </label>
              <span className={`text-xs ${note.length > 140 ? 'text-red-600 dark:text-red-400' : 'text-[#94A3B8] dark:text-zinc-500'}`}>
                {note.length}/140
              </span>
            </div>
            <textarea
              id="declare-note"
              rows={2}
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Brainstormed topic ideas with ChatGPT, then wrote independently..."
              className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl p-3 text-xs md:text-sm text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <MomenWatermark variant="inline" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Certify Declaration'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
