import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, CheckCircle, HelpCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Snapshot, AIDeclaration, ServerMetaResponse } from '../types';
import { ReplayPlayer } from './ReplayPlayer';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  docId: string;
  shareToken?: string;
  importedBundle?: any;
  onBackToApp: () => void;
}

export const ReviewerView: React.FC<Props> = ({
  docId,
  shareToken,
  importedBundle,
  onBackToApp,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Review Document');
  const [studentId, setStudentId] = useState<string>('');
  const [studentClass, setStudentClass] = useState<string>('');
  const [declaration, setDeclaration] = useState<AIDeclaration | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [captureSpanMs, setCaptureSpanMs] = useState<number>(0);
  const [captureStartMs, setCaptureStartMs] = useState<number>(0);
  const [captureEndMs, setCaptureEndMs] = useState<number>(0);
  const [isImported, setIsImported] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      // 1. Handle imported bundle directly
      if (importedBundle) {
        try {
          setIsImported(true);
          setTitle(importedBundle.title || 'Imported Replay');
          setStudentId(importedBundle.studentId || '');
          setStudentClass(importedBundle.studentClass || '');
          setDeclaration(importedBundle.declaration || null);

          let span = importedBundle.captureSpanMs || 0;
          let start = importedBundle.captureStartMs || 0;
          let end = importedBundle.captureEndMs || 0;

          if (importedBundle.captureStartMs !== undefined && importedBundle.captureEndMs !== undefined) {
            if (importedBundle.captureEndMs >= importedBundle.captureStartMs) {
              span = importedBundle.captureEndMs - importedBundle.captureStartMs;
              start = importedBundle.captureStartMs;
              end = importedBundle.captureEndMs;
            } else {
              span = 0;
              start = 0;
              end = 0;
            }
          }

          setCaptureSpanMs(span);
          setCaptureStartMs(start);
          setCaptureEndMs(end);

          const snapList: Snapshot[] = (importedBundle.snapshots || []).map((s: any, idx: number) => ({
            docId: 'imported',
            snapshotId: `imported-${idx}`,
            seq: s.seq || idx + 1,
            t: s.t || Date.now(),
            clientT: s.clientT || s.t || Date.now(),
            text: s.text || '',
            eventType: s.eventType || 'pause',
            inserted: s.inserted || 0,
            deleted: s.deleted || 0,
            countSource: s.countSource || 'diff-estimate',
          }));

          setSnapshots(snapList);
        } catch (err: any) {
          setError('Failed to parse imported bundle');
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2. Fetch from server via shareToken or docId
      if (!shareToken) {
        setError('No reviewer share token was provided in the URL.');
        setLoading(false);
        return;
      }

      try {
        const metaRes = await fetch(`/api/docs/${docId}/meta`, {
          headers: { Authorization: `Bearer ${shareToken}` },
        });

        if (metaRes.status === 401 || metaRes.status === 403) {
          throw new Error('Invalid or expired reviewer share token. Please ask the author for a new link.');
        }
        if (metaRes.status === 404) {
          throw new Error('Document was not found or has been removed.');
        }
        if (!metaRes.ok) {
          throw new Error('Failed to load document metadata.');
        }

        const metaData: ServerMetaResponse = await metaRes.json();
        setTitle(metaData.title || 'Untitled Document');
        setStudentId(metaData.studentId || '');
        setStudentClass(metaData.studentClass || '');
        setDeclaration(metaData.declaration || null);
        setCaptureSpanMs(metaData.captureSpanMs || 0);
        setCaptureStartMs(metaData.captureStartMs || 0);
        setCaptureEndMs(metaData.captureEndMs || 0);
        setIsDemo(!!metaData.isDemo);

        const totalSnapshots = metaData.snapshots.length;
        const fullSnapshots: Snapshot[] = [];

        for (let offset = 0; offset < totalSnapshots; offset += 50) {
          const chunkRes = await fetch(
            `/api/docs/${docId}/replay?offset=${offset}&limit=50`,
            {
              headers: { Authorization: `Bearer ${shareToken}` },
            }
          );

          if (!chunkRes.ok) {
            throw new Error(`Failed to load replay chunk at offset ${offset}`);
          }

          const chunkData = await chunkRes.json();
          for (let i = 0; i < chunkData.snapshots.length; i++) {
            const m = metaData.snapshots[offset + i];
            const text = chunkData.snapshots[i].text;
            fullSnapshots.push({
              docId,
              snapshotId: m.snapshotId || `snap-${m.seq}`,
              seq: m.seq,
              t: m.t,
              clientT: m.clientT || m.t,
              text,
              eventType: m.eventType,
              inserted: m.inserted,
              deleted: m.deleted,
              countSource: m.countSource,
            });
          }
        }

        setSnapshots(fullSnapshots);
      } catch (err: any) {
        setError(err.message || 'Network error reaching server');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [docId, shareToken, importedBundle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#101114] flex flex-col items-center justify-center text-[#171923] dark:text-[#ECEEF2] p-6 transition-colors duration-180">
        <div className="w-12 h-12 border-3 border-emerald-500/20 border-t-emerald-600 dark:border-t-emerald-400 rounded-full animate-spin mb-4" />
        <h3 className="text-lg font-medium text-[#171923] dark:text-[#ECEEF2]">Loading document replay & declaration...</h3>
        <p className="text-xs text-[#64748B] dark:text-[#9298A3] mt-1">Fetching metadata and text chunks in 50-state batches</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#101114] flex flex-col items-center justify-center text-[#171923] dark:text-[#ECEEF2] p-6 transition-colors duration-180">
        <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700/50 rounded-xl text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#171923] dark:text-[#ECEEF2]">Unable to Open Replay</h2>
          <p className="text-sm text-[#64748B] dark:text-[#9298A3]">{error}</p>
          <button
            onClick={onBackToApp}
            className="w-full py-2.5 px-4 bg-[#FFFFFF] dark:bg-[#22252B] hover:bg-[#F1F5F9] dark:hover:bg-[#292D33] border border-[#E2E8F0] dark:border-[#292D33] text-[#171923] dark:text-[#ECEEF2] text-sm font-medium rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Go to DraftReplay Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#101114] text-[#171923] dark:text-[#ECEEF2] flex flex-col p-4 md:p-8 transition-colors duration-180">
      {/* Top Header */}
      <div className="max-w-7xl w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-2.5 bg-[#FFFFFF] dark:bg-[#17191D] hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl text-[#64748B] dark:text-[#9298A3] hover:text-[#171923] dark:hover:text-[#ECEEF2] transition-colors cursor-pointer shadow-xs"
            title="Return"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                Reviewer Mode
              </span>
              <span className="text-xs text-[#64748B] dark:text-[#9298A3] font-mono">ID: {docId}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#171923] dark:text-[#ECEEF2] tracking-tight mt-0.5">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Main Grid: Replay Player + Declaration Card BESIDE IT */}
      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* Left Column: Replay Player */}
        <div className="lg:col-span-7 h-full flex flex-col">
          <ReplayPlayer
            title={title}
            studentId={studentId}
            studentClass={studentClass}
            snapshots={snapshots}
            declaration={declaration}
            captureSpanMs={captureSpanMs}
            captureStartMs={captureStartMs}
            captureEndMs={captureEndMs}
            isReviewer={true}
            isImported={isImported}
            isDemo={isDemo}
          />
        </div>

        {/* Right Column: Equal-size Self-Declaration Card + "What this shows / cannot tell you" Card */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Declaration Card BESIDE Replay */}
          <div className="bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#171923] dark:text-[#ECEEF2]">
                  Author&apos;s Self-Declaration
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Reported alongside writing replay</p>
              </div>
            </div>

            {declaration ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                    Declared Assistance Level
                  </div>
                  <div className="text-base font-bold text-[#171923] dark:text-[#ECEEF2] capitalize">
                    {declaration.level === 'none' && 'No AI help'}
                    {declaration.level === 'ideas' && 'AI for ideas only (brainstorm, structure)'}
                    {declaration.level === 'drafted' && 'AI helped draft some text'}
                    {declaration.level === 'wrote-parts' && 'AI wrote parts of this'}
                  </div>
                  {declaration.note && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#292D33]">
                      <div className="text-xs text-[#64748B] dark:text-[#9298A3] mb-1">Author Note:</div>
                      <p className="text-sm text-[#171923] dark:text-[#ECEEF2] italic font-sans leading-relaxed">
                        &quot;{declaration.note}&quot;
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-[#94A3B8] dark:text-zinc-500 italic">
                  Your self-declaration — not proof of how this was written. The declaration sits
                  beside the evidence as an equal.
                </div>
              </div>
            ) : (
              <div className="p-5 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl text-center">
                <p className="text-sm text-[#64748B] dark:text-zinc-400">
                  No AI self-declaration submitted for this document yet.
                </p>
              </div>
            )}
          </div>

          {/* Two-column card: "What this shows / What this cannot tell you" */}
          <div className="bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#171923] dark:text-[#ECEEF2] font-bold text-sm tracking-wide">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Reviewer Guidance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs md:text-sm">
              {/* Column 1: What this shows */}
              <div className="p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-emerald-200 dark:border-emerald-900/40 rounded-xl space-y-2">
                <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>What this shows</span>
                </div>
                <ul className="space-y-1.5 text-[#64748B] dark:text-zinc-300 list-disc list-inside text-xs leading-relaxed">
                  <li>How the text arrived over time</li>
                  <li>Where blocks were pasted</li>
                  <li>What the student declared</li>
                </ul>
              </div>

              {/* Column 2: What this cannot tell you */}
              <div className="p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>What this cannot tell you</span>
                </div>
                <ul className="space-y-1.5 text-[#64748B] dark:text-zinc-300 list-disc list-inside text-xs leading-relaxed">
                  <li>Who actually typed</li>
                  <li>Whether a paste was a quotation</li>
                  <li>Author intent</li>
                  <li>
                    How long you actually spent — only the span between the first and last saved
                    state is visible, and it comes from the student&apos;s own device clock
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
