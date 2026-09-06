export interface SopVersion {
  sopId: string;
  businessId: string;
  version: number;
  title: string;
  category: string;
  shortDescription: string;
  purpose: string;
  instructions: string;
  safetyInformation: string;
  attachmentFileIds: string[];
  publishedAt: string;
  publishedBy: string;
}

export interface MySopListResponse { ok: true; sops: SopVersion[] }
export interface MySopDetailResponse { ok: true; sop: SopVersion }
export interface SopCache { identityKey: string; updatedAt: string; sops: SopVersion[] }