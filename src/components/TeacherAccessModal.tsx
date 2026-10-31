import React, { useState } from 'react';
import { X, Lock, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetActionName?: string;
}

export const TeacherAccessModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  targetActionName = "Teacher's Corner",
}) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Verify password strictly against yokoso@1
    if (password.trim() !== 'yokoso@1') {
      setError('Incorrect teacher password. Access denied.');
      return;
    }

    setPassword('');
    setError(null);
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-access-title"
      >
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 id="teacher-access-title" className="text-xl font-semibold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Teacher Access Required
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Restricted to educators only</p>
          </div>
        </div>

        <div className="mb-5 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl p-4 text-xs md:text-sm text-[#64748B] dark:text-zinc-300 leading-relaxed">
          <p>
            Please enter the teacher password to unlock{' '}
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{targetActionName}</span> and review student writing history, replays, and declarations.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="teacher-password" className="block text-xs font-semibold text-[#171923] dark:text-zinc-300 mb-1.5">
              Teacher Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-zinc-500" />
              <input
                id="teacher-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password..."
                className="w-full bg-[#FFFFFF] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-600 dark:focus:ring-emerald-500 rounded-xl pl-10 pr-11 py-2.5 text-sm text-[#171923] dark:text-[#ECEEF2] placeholder-[#94A3B8] dark:placeholder-zinc-600 outline-hidden font-mono"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-zinc-500 hover:text-[#171923] dark:hover:text-zinc-300 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Unlock Teacher Access</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 px-4 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex justify-center pt-2">
            <MomenWatermark variant="inline" />
          </div>
        </form>
      </div>
    </div>
  );
};
