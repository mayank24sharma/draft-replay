import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, FastForward, Info, Copy, Check } from 'lucide-react';
import { Snapshot, AIDeclaration } from '../types';
import { computeSpanDisplay } from '../lib/time';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  title: string;
  studentId?: string;
  studentClass?: string;
  snapshots: Snapshot[];
  declaration?: AIDeclaration | null;
  captureSpanMs?: number;
  captureStartMs?: number;
  captureEndMs?: number;
  isReviewer?: boolean;
  isImported?: boolean;
  isDemo?: boolean;
  onClose?: () => void;
}

export const ReplayPlayer: React.FC<Props> = ({
  title,
  studentId,
  studentClass,
  snapshots,
  declaration,
  captureSpanMs,
  captureStartMs,
  captureEndMs,
  isReviewer = false,
  isImported = false,
  isDemo = false,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1000); // 1 sec per user request
  const [copied, setCopied] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  // Set initial slider index to latest snapshot if not playing
  useEffect(() => {
    if (snapshots.length > 0) {
      setCurrentIndex(snapshots.length - 1);
    }
  }, [snapshots.length]);

  // Playback timer: 1 sec (1000 ms) default per user request
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= snapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, snapshots.length, playbackSpeed]);

  const currentSnapshot = snapshots[currentIndex] || snapshots[0] || null;
  const currentText = currentSnapshot?.text || '';

  // Bar heights computed AT RENDER TIME from consecutive snapshot text diff per spec
  const barHeights = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    const diffs: number[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      if (i === 0) {
        diffs.push(snapshots[0].text.length);
      } else {
        const prevLen = snapshots[i - 1].text.length;
        const curLen = snapshots[i].text.length;
        diffs.push(Math.abs(curLen - prevLen));
      }
    }
    const maxDiff = Math.max(...diffs, 50);
    return diffs.map((d) => Math.max(8, Math.min(100, Math.round((d / maxDiff) * 100))));
  }, [snapshots]);

  // Compute time span
  const spanDisplay = useMemo(() => {
    if (snapshots.length === 0) {
      return computeSpanDisplay(0, 0, 0);
    }

    const startMs = captureStartMs ?? snapshots[0].clientT ?? snapshots[0].t;
    const endMs = captureEndMs ?? snapshots[snapshots.length - 1].clientT ?? snapshots[snapshots.length - 1].t;
    const span = captureSpanMs ?? Math.max(0, endMs - startMs);

    return computeSpanDisplay(snapshots.length, startMs, endMs, span);
  }, [snapshots, captureSpanMs, captureStartMs, captureEndMs]);

  const eventCard = useMemo(() => {
    if (!currentSnapshot || currentIndex === 0) return null;
    const { eventType, inserted, deleted } = currentSnapshot;

    if (eventType === 'paste') {
      return {
        type: 'paste',
        label: 'Pasted as a block',
        badge: 'amber',
      };
    }
    if (eventType === 'large_delete') {
      if (inserted > 0) {
        return {
          type: 'large_delete',
          label: `Replaced approx. ${deleted} characters with ${inserted}`,
          badge: 'red',
        };
      }
      return {
        type: 'large_delete',
        label: `Removed approx. ${deleted} characters`,
        badge: 'red',
      };
    }
    if (eventType === 'undo') {
      return {
        type: 'undo',
        label: 'Undo',
        badge: 'zinc',
      };
    }
    return null;
  }, [currentSnapshot, currentIndex]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] dark:bg-[#14161A] text-[#171923] dark:text-[#ECEEF2] rounded-2xl border border-[#E2E8F0] dark:border-[#292D33] shadow-md overflow-hidden transition-colors duration-180">
      {/* Persistent Badge Header */}
      {isDemo && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-600/50 px-4 py-1.5 text-center">
          <span className="text-xs font-bold tracking-widest text-amber-800 dark:text-amber-300 uppercase">
            FICTIONAL DEMO DOCUMENT
          </span>
        </div>
      )}

      {isImported && (
        <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-300 dark:border-amber-600/40 px-4 py-1.5 text-center">
          <span className="text-xs font-bold tracking-wider text-amber-800 dark:text-amber-300 uppercase">
            Imported replay — history not independently verified.
          </span>
        </div>
      )}

      {/* Top Bar */}
      <div className="p-4 md:px-6 md:py-4 border-b border-[#E2E8F0] dark:border-[#292D33] bg-[#F8FAFC] dark:bg-[#17191D] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight line-clamp-1">
              {title || 'Untitled Document'}
            </h2>
            {studentId && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold font-mono">
                Student ID: {studentId} {studentClass ? `(${studentClass})` : ''}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-md bg-[#E2E8F0] dark:bg-[#22252B] text-[#64748B] dark:text-[#9298A3] font-mono">
              Seq #{currentSnapshot?.seq || currentIndex + 1} / {snapshots.length}
            </span>
          </div>
          {/* Always visible on-screen note required by spec */}
          <div className="text-xs text-[#64748B] dark:text-[#9298A3] mt-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              Shows saved states, not every keystroke.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyText}
            className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] transition-colors cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
            title="Copy current state"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-xs font-medium cursor-pointer shadow-xs"
            >
              Back to Editor
            </button>
          )}
        </div>
      </div>

      {/* Time Span Indicator Card */}
      <div className="px-4 py-3 md:px-6 bg-[#F8FAFC] dark:bg-[#101114]/60 border-b border-[#E2E8F0] dark:border-[#292D33]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs md:text-sm font-sans">
          <div className="font-semibold text-[#171923] dark:text-[#ECEEF2]">{spanDisplay.line1}</div>
          {spanDisplay.line2 && (
            <div className="text-[#64748B] dark:text-[#9298A3] font-mono text-xs">{spanDisplay.line2}</div>
          )}
        </div>
        <p className="text-xs text-[#94A3B8] dark:text-zinc-500 mt-1 leading-normal italic">
          {spanDisplay.caveat}
        </p>
      </div>

      {/* Active Event Card Toast/Pill */}
      {eventCard && (
        <div className="px-6 pt-3 pb-1">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-semibold tracking-wide shadow-xs animate-in fade-in duration-200 ${
              eventCard.badge === 'amber'
                ? 'bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300'
                : eventCard.badge === 'red'
                ? 'bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-500/50 text-red-800 dark:text-red-300'
                : 'bg-[#F1F5F9] dark:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                eventCard.badge === 'amber'
                  ? 'bg-amber-500 animate-pulse'
                  : eventCard.badge === 'red'
                  ? 'bg-red-500'
                  : 'bg-zinc-400'
              }`}
            />
            <span>{eventCard.label}</span>
          </div>
        </div>
      )}

      {/* Growing Document Text Viewer - Editor Background */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto font-sans leading-relaxed text-[#171923] dark:text-[#ECEEF2] text-base md:text-lg whitespace-pre-wrap selection:bg-emerald-500/20 min-h-[220px]">
        {currentText || (
          <span className="text-[#94A3B8] dark:text-zinc-600 italic">No text in this saved state.</span>
        )}
      </div>

      {/* Time Strip / Timeline Bars */}
      <div className="px-4 md:px-6 pt-3 pb-2 border-t border-[#E2E8F0] dark:border-[#292D33] bg-[#F8FAFC] dark:bg-[#17191D]">
        <div className="flex items-end gap-1 h-12 w-full px-1 overflow-x-auto">
          {snapshots.map((s, idx) => {
            const height = barHeights[idx] || 10;
            const isCurrent = idx === currentIndex;
            const isPaste = s.eventType === 'paste';
            const isLargeDelete = s.eventType === 'large_delete';

            let barColor = 'bg-[#CBD5E1] dark:bg-[#292D33] hover:bg-[#94A3B8] dark:hover:bg-[#3E444E]';
            if (isCurrent) barColor = 'bg-emerald-600 dark:bg-emerald-400 ring-2 ring-emerald-500/40';
            else if (isPaste) barColor = 'bg-amber-500';
            else if (isLargeDelete) barColor = 'bg-red-500';

            return (
              <button
                key={s.snapshotId || idx}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentIndex(idx);
                }}
                title={`#${s.seq || idx + 1} (${s.eventType}) - ${s.text.length} chars`}
                className="flex-1 min-w-[5px] max-w-[20px] flex flex-col items-center justify-end h-full group focus:outline-hidden cursor-pointer"
              >
                <div
                  style={{ height: `${height}%` }}
                  className={`w-full rounded-t-xs transition-all ${barColor}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrubber Controls */}
      <div className="p-4 md:px-6 md:py-4 bg-[#FFFFFF] dark:bg-[#17191D] border-t border-[#E2E8F0] dark:border-[#292D33] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, snapshots.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(parseInt(e.target.value, 10));
            }}
            className="w-full accent-emerald-600 dark:accent-emerald-500 bg-[#E2E8F0] dark:bg-[#292D33] h-2 rounded-lg cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (currentIndex >= snapshots.length - 1) {
                  setCurrentIndex(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white font-medium shadow-xs transition-all flex items-center gap-1.5 text-xs cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'Pause' : `Play (${playbackSpeed / 1000}s)`}</span>
            </button>

            {/* Playback Speed selector */}
            <div className="flex items-center bg-[#F1F5F9] dark:bg-[#22252B] rounded-xl p-0.5 border border-[#E2E8F0] dark:border-[#292D33] text-[11px] font-mono">
              {[500, 1000, 2000].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-bold'
                      : 'text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2]'
                  }`}
                >
                  {spd === 500 ? '0.5s' : spd === 1000 ? '1s' : '2s'}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              className="p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
              title="Reset to first save"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentIndex(snapshots.length - 1);
              }}
              className="p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
              title="Jump to latest save"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#64748B] dark:text-[#9298A3]">
            {currentSnapshot ? (
              <span>
                {currentText.length} chars · {currentSnapshot.eventType}
              </span>
            ) : null}
            <MomenWatermark variant="inline" />
          </div>
        </div>
      </div>
    </div>
  );
};
