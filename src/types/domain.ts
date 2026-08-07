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

export interface Job {
  id: string;
  title: string;
  status: 'scheduled' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assignedEmployeeIds: string[];
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  jobId?: string;
  jobIds?: string[];
  workType: TimeEntryWorkType;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  notes: string;
  photoAttachmentFileId?: string;
  clockOutPhotoFileId?: string;
  status: ClockStatus;
}
