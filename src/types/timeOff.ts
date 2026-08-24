export type TimeOffRequestType = 'vacation' | 'sick' | 'personal' | 'unpaid' | 'other';
export type TimeOffRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export type TimeOffRequest = {
  id: string;
  requestType: TimeOffRequestType;
  startDate: string;
  endDate: string;
  employeeNote: string;
  status: TimeOffRequestStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTimeOffRequest = {
  requestType: TimeOffRequestType;
  startDate: string;
  endDate: string;
  employeeNote: string;
  idempotencyKey: string;
};

export type CreateTimeOffResponse = {
  ok: true;
  request: TimeOffRequest;
  replayed?: boolean;
  warnings?: string[];
};

export type ListTimeOffResponse = { ok: true; items: TimeOffRequest[] };
export type TimeOffDetailResponse = { ok: true; request: TimeOffRequest };
export type CancelTimeOffResponse = { ok: true; request: TimeOffRequest };