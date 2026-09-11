import type { ContentMode, PdfDocumentMetadata } from '@/types/document';

export type TrainingRecurrenceType = 'one_time' | 'annual' | 'custom_months';
export type TrainingStatus = 'not_started' | 'due_soon' | 'overdue' | 'current' | 'revoked';

export interface TrainingChecklistItem {
  itemId: string;
  text: string;
  required: true;
  sortOrder: number;
}

export interface TrainingSection {
  sectionId: string;
  title: string;
  description: string;
  sortOrder: number;
  checklistItems: TrainingChecklistItem[];
}

export interface TrainingVersion {
  businessId: string;
  trainingId: string;
  version: number;
  title: string;
  contentMode?: ContentMode;
  document?: PdfDocumentMetadata | null;
  shortDescription: string;
  instructions: string;
  attachmentFileId: string | null;
  checklist: TrainingChecklistItem[];
  trainingSections?: TrainingSection[];
  acknowledgementStatement: string;
  recurrenceType: TrainingRecurrenceType;
  recurrenceMonths: number | null;
  dueSoonDays: number;
  createdAt: string;
  createdBy: string;
}

export interface TrainingAssignment {
  id: string;
  assignmentId: string;
  businessId: string;
  trainingId: string;
  trainingTitle: string;
  assignedVersion: number;
  employeeId: string;
  employeeName: string;
  assignedAt: string;
  assignedBy: string;
  initialDueDate: string;
  currentDueDate: string | null;
  recurrenceType: TrainingRecurrenceType;
  recurrenceMonths: number | null;
  dueSoonDays: number;
  latestCompletionId: string | null;
  latestCompletedAt: string | null;
  nextDueDate: string | null;
  revokedAt?: string;
  presentationStatus: TrainingStatus;
}

export interface TrainingCompletion {
  id: string;
  completionId: string;
  businessId: string;
  assignmentId: string;
  employeeId: string;
  trainingId: string;
  completedVersion: number;
  trainingTitle: string;
  contentMode?: ContentMode;
  document?: PdfDocumentMetadata | null;
  checklistItems: Array<Pick<TrainingChecklistItem, 'itemId' | 'text' | 'required'> & { checked: true }>;
  acknowledgementStatement: string;
  acknowledged: true;
  signatureName: string;
  signedAt: string;
  completedAt: string;
  nextDueDate: string | null;
  submissionId: string;
}

export interface MyTrainingListResponse {
  ok: true;
  assignments: TrainingAssignment[];
  attentionCount: number;
}

export interface MyTrainingDetailResponse {
  ok: true;
  assignment: TrainingAssignment;
  version: TrainingVersion;
}

export interface MyTrainingHistoryResponse {
  ok: true;
  completions: TrainingCompletion[];
}

export interface CompleteTrainingRequest {
  assignmentId: string;
  submissionId: string;
  checklistResponses: Array<{ itemId: string; checked: true }>;
  acknowledged: true;
  signatureName: string;
}

export interface CompleteTrainingResponse {
  ok: true;
  completion: TrainingCompletion;
  replayed: boolean;
}