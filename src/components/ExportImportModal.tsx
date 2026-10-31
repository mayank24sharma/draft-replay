import React, { useState } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { DocumentMeta, ExportBundle } from '../types';
import { getLocalSnapshots, getLocalDoc } from '../lib/db';
import { MomenWatermark } from './MomenWatermark';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDoc: DocumentMeta;
  onImportReplay: (bundle: ExportBundle) => void;
}

export const ExportImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentDoc,
  onImportReplay,
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  // Client-side export complying strictly with allow-list only and T14
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const doc = (await getLocalDoc(currentDoc.docId)) || currentDoc;
      const snaps = await getLocalSnapshots(currentDoc.docId);

      let captureStartMs: number | undefined = undefined;
      let captureEndMs: number | undefined = undefined;
      let captureSpanMs: number | undefined = undefined;

      if (snaps.length >= 2) {
        captureStartMs = snaps[0].clientT;
        captureEndMs = snaps[snaps.length - 1].clientT;
        captureSpanMs = Math.max(0, captureEndMs - captureStartMs);
      } else if (snaps.length === 1) {
        captureStartMs = snaps[0].clientT;
        captureEndMs = snaps[0].clientT;
        captureSpanMs = 0;
      }

      const exportBundle: ExportBundle = {
        title: doc.title,
        studentId: doc.studentId,
        studentClass: doc.studentClass,
        version: doc.version,
        exportTime: Date.now(),
        declaration: doc.declaration,
        snapshots: snaps.map((s) => ({
          seq: s.seq,
          t: s.t,
          eventType: s.eventType,
          inserted: s.inserted,
          deleted: s.deleted,
          countSource: s.countSource,
          text: s.text,
        })),
        ...(captureSpanMs !== undefined ? { captureSpanMs } : {}),
        ...(captureStartMs !== undefined ? { captureStartMs } : {}),
        ...(captureEndMs !== undefined ? { captureEndMs } : {}),
      };

      const jsonStr = JSON.stringify(exportBundle, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draftreplay-${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setImportError('Failed to generate export bundle: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Import handler with strict JSON schema validation (T17)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setImportError('File exceeds maximum allowable size (20 MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON: Root must be an object.');
        }
        if (typeof parsed.title !== 'string') {
          throw new Error('Invalid schema: Missing string "title".');
        }
        if (!Array.isArray(parsed.snapshots)) {
          throw new Error('Invalid schema: "snapshots" must be an array.');
        }

        for (let i = 0; i < parsed.snapshots.length; i++) {
          const s = parsed.snapshots[i];
          if (typeof s.text !== 'string') {
            throw new Error(`Invalid schema: Snapshot #${i + 1} is missing "text".`);
          }
          if (s.text.length > 65536) {
            throw new Error(`Snapshot #${i + 1} text exceeds 64 KB limit.`);
          }
        }

        if (parsed.captureStartMs !== undefined && parsed.captureEndMs !== undefined) {
          if (typeof parsed.captureStartMs !== 'number' || typeof parsed.captureEndMs !== 'number') {
            parsed.captureSpanMs = undefined;
            parsed.captureStartMs = undefined;
            parsed.captureEndMs = undefined;
          } else if (parsed.captureEndMs >= parsed.captureStartMs) {
            parsed.captureSpanMs = parsed.captureEndMs - parsed.captureStartMs;
          } else {
            parsed.captureSpanMs = undefined;
            parsed.captureStartMs = undefined;
            parsed.captureEndMs = undefined;
          }
        }

        setImportSuccess(`Loaded "${parsed.title}" with ${parsed.snapshots.length} saved states.`);
        setTimeout(() => {
          onImportReplay(parsed);
          onClose();
        }, 600);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#17191D] border border-[#E2E8F0] dark:border-[#292D33] rounded-2xl shadow-xl p-6 md:p-8 text-[#171923] dark:text-[#ECEEF2] relative transition-colors duration-180"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-import-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#F1F5F9] dark:hover:bg-[#22252B] transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 id="export-import-title" className="text-xl font-semibold text-[#171923] dark:text-[#ECEEF2] tracking-tight">
              Export & Import Bundles
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#9298A3]">Client-side document packages</p>
          </div>
        </div>

        {importError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{importError}</span>
          </div>
        )}

        {importSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{importSuccess}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Export Section */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#171923] dark:text-zinc-200">Export Current Document</span>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-[#E2E8F0] dark:bg-[#22252B] text-[#64748B] dark:text-zinc-400">JSON</span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-zinc-400 mb-3 leading-relaxed">
              Downloads a complete replay bundle directly from your local cache. Contains all saved
              states, time spans, and your self-declaration. Your private write key is never included.
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-[#10B981] dark:hover:bg-[#059669] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generating Bundle...' : 'Download Client-Side Bundle'}</span>
            </button>
          </div>

          {/* Import Section */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-[#14161A] border border-[#E2E8F0] dark:border-[#292D33] rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#171923] dark:text-zinc-200">Import a Bundle to Review</span>
              <span className="text-xs px-2 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-600/40 text-amber-800 dark:text-amber-300">
                Unverified Replay
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-zinc-400 mb-3 leading-relaxed">
              Open a previously exported DraftReplay JSON file to replay its writing progression.
              Imported files display a persistent &quot;history not independently verified&quot; banner.
            </p>
            <label className="w-full py-2.5 px-4 bg-[#FFFFFF] hover:bg-[#F1F5F9] dark:bg-[#22252B] dark:hover:bg-[#292D33] text-[#171923] dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#E2E8F0] dark:border-[#292D33] shadow-xs">
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Select DraftReplay JSON File</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <MomenWatermark variant="inline" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#64748B] hover:text-[#171923] dark:text-zinc-400 dark:hover:text-zinc-200 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#22252B] dark:hover:bg-[#292D33] rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
