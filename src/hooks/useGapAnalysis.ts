import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeWardrobeGaps } from '../engine/gapAnalyzer';
import { computeGapStructuralKey } from '../engine/gapCacheKey';
import { BiometricProfile, GapAnalysisReport, Garment } from '../types/wardrobe';
import type { GapWorkerRequest, GapWorkerResponse } from '../workers/gapAnalyzer.worker';

const MAX_CACHE_ENTRIES = 12;

export function useGapAnalysis(
  garments: Garment[],
  profile: BiometricProfile
): {
  gapReport: GapAnalysisReport;
  isAnalyzingGaps: boolean;
} {
  const cacheMapRef = useRef<Map<string, GapAnalysisReport>>(new Map());
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const structuralKey = useMemo(
    () => computeGapStructuralKey(garments, profile),
    [garments, profile]
  );

  // Compute initial report synchronously once for immediate first paint
  const [state, setState] = useState<{
    key: string;
    report: GapAnalysisReport;
    isAnalyzing: boolean;
  }>(() => {
    const initialReport = analyzeWardrobeGaps(garments, profile);
    cacheMapRef.current.set(structuralKey, initialReport);
    return {
      key: structuralKey,
      report: initialReport,
      isAnalyzing: false,
    };
  });

  // Initialize Web Worker in browser environments
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return;
    }
    try {
      const worker = new Worker(
        new URL('../workers/gapAnalyzer.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (event: MessageEvent<GapWorkerResponse>) => {
        const { requestId, structuralKey: resolvedKey, report } = event.data;
        if (cacheMapRef.current.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = cacheMapRef.current.keys().next().value;
          if (oldestKey) cacheMapRef.current.delete(oldestKey);
        }
        cacheMapRef.current.set(resolvedKey, report);
        if (requestId === requestIdRef.current) {
          setState({
            key: resolvedKey,
            report,
            isAnalyzing: false,
          });
        }
      };
      workerRef.current = worker;
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      workerRef.current = null;
      return;
    }
  }, []);

  // Trigger calculation when structuralKey changes
  useEffect(() => {
    const cached = cacheMapRef.current.get(structuralKey);
    if (cached) {
      setState((prev) =>
        prev.key === structuralKey && !prev.isAnalyzing
          ? prev
          : { key: structuralKey, report: cached, isAnalyzing: false }
      );
      return;
    }

    if (workerRef.current) {
      const nextRequestId = ++requestIdRef.current;
      setState((prev) => ({ ...prev, isAnalyzing: true }));
      const payload: GapWorkerRequest = {
        requestId: nextRequestId,
        structuralKey,
        garments,
        profile,
      };
      workerRef.current.postMessage(payload);
    } else {
      const computed = analyzeWardrobeGaps(garments, profile);
      cacheMapRef.current.set(structuralKey, computed);
      setState({
        key: structuralKey,
        report: computed,
        isAnalyzing: false,
      });
    }
  }, [structuralKey, garments, profile]);

  const activeReport = cacheMapRef.current.get(structuralKey) ?? state.report;

  return {
    gapReport: activeReport,
    isAnalyzingGaps: state.isAnalyzing && !cacheMapRef.current.has(structuralKey),
  };
}
