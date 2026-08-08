export type UserRole = 'owner' | 'admin' | 'foreman' | 'crew_member';

export interface SessionUser {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: UserRole;
  businessName: string;
  employeeId?: string;
}

export type TimeEntryWorkType = 'job' | 'drive_time' | 'non_billable';
export type ClockStatus = 'clocked_in' | 'clocked_out';
export type TimeCorrectionRequestType =
  | 'forgot_clock_in'
  | 'forgot_clock_out'
  | 'wrong_time'
  | 'wrong_job'
  | 'wrong_activity'
  | 'split_activity'
  | 'other';
export type TimeCorrectionRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TimeCorrectionSegmentRequest {
  id: string;
  startAt: string;
  endAt: string;
  requestedJobId?: string;
  requestedActivityType: TimeEntryWorkType;
  notes?: string;
}

export interface TimeCorrectionRequest {
  id: string;
  employeeId: string;
  timeEntryId?: string;
  requestType: TimeCorrectionRequestType;
  status: TimeCorrectionRequestStatus;
  requestedClockInAt?: string;
  requestedClockOutAt?: string;
  requestedJobId?: string;
  requestedActivityType?: TimeEntryWorkType;
  requestedUnbillableCategoryId?: string;
  requestedUnbillableCategoryName?: string;
  requestedSegments?: TimeCorrectionSegmentRequest[];
  reason: string;
  submittedByUserId: string;
  submittedAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
  reviewNote?: string;
  originalClockInAt?: string;
  originalClockOutAt?: string;
  originalJobId?: string;
  originalJobIds?: string[];
  originalActivityType?: TimeEntryWorkType;
  originalUnbillableCategoryId?: string;
  originalUnbillableCategoryName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  title: string;
  status: 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assignedEmployeeIds: string[];
}

export interface UnbillableCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  jobId?: string;
  jobIds?: string[];
  workType: TimeEntryWorkType;
  unbillableCategoryId?: string;
  unbillableCategoryName?: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  notes: string;
  photoAttachmentFileIds?: string[];
  photoAttachmentFileId?: string;
  clockOutPhotoFileIds?: string[];
  clockOutPhotoFileId?: string;
  status: ClockStatus;
}
