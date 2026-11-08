import { analyzeWardrobeGaps } from '../engine/gapAnalyzer';
import { BiometricProfile, GapAnalysisReport, Garment } from '../types/wardrobe';

export interface GapWorkerRequest {
  requestId: number;
  structuralKey: string;
  garments: Garment[];
  profile: BiometricProfile;
}

export interface GapWorkerResponse {
  requestId: number;
  structuralKey: string;
  report: GapAnalysisReport;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<GapWorkerRequest>) => void) | null;
  postMessage: (message: GapWorkerResponse) => void;
};

workerScope.onmessage = (event: MessageEvent<GapWorkerRequest>) => {
  const { requestId, structuralKey, garments, profile } = event.data;
  const report = analyzeWardrobeGaps(garments, profile);
  workerScope.postMessage({
    requestId,
    structuralKey,
    report,
  });
};
