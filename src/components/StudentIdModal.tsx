import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle2, Shield } from 'lucide-react';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentStudentId: string;
  onSaveStudentId: (newId: string) => void;
}

export const StudentIdModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentStudentId,
  onSaveStudentId,
}) => {
  const [studentIdInput, setStudentIdInput] = useState<string>(currentStudentId);

  if (!isOpen) return null;

  const handleGenerateRandom = () => {
    const randomId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setStudentIdInput(randomId);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = studentIdInput.trim() || `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    onSaveStudentId(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-id-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 id="student-id-title" className="text-lg font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Unique Student Identifier
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Assign or switch your student ID</p>
          </div>
        </div>

        <p className="text-xs text-[#64748B] dark:text-zinc-300 mb-4 leading-relaxed bg-[#F8FAFC] dark:bg-[#14161A] p-3 rounded-xl border border-[#E2E8F0] dark:border-[#292D33]">
          Every student in the classroom possesses a unique ID so teachers can identify, track, and grade submissions independently.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#171923] dark:text-zinc-300 mb-1.5">
              Student ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
                placeholder="e.g. STU-2026-4891"
                className="flex-1 bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl px-3.5 py-2 font-mono text-sm text-emerald-700 dark:text-emerald-400 font-semibold outline-hidden"
                required
              />
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] text-[#171923] dark:text-zinc-200 text-xs font-medium rounded-xl border border-[#E2E8F0] dark:border-[#292D33] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Generate new random student ID"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Generate</span>
              </button>
            </div>
            <p className="text-[11px] text-[#94A3B8] dark:text-zinc-500 mt-1.5">
              Format: <span className="font-mono text-[#64748B] dark:text-zinc-400">STU-2026-XXXX</span> or your school roll number.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between">
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Student ID</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
