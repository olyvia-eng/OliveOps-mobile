import { isValidFormDate } from '@/features/forms/formValidation';
import type { TimeOffDraft } from '@/store/timeOffStore';

export type TimeOffDraftErrors = Partial<Record<keyof TimeOffDraft, string>>;

export function validateTimeOffDraft(draft: TimeOffDraft): TimeOffDraftErrors {
  const errors: TimeOffDraftErrors = {};
  if (!isValidFormDate(draft.startDate)) errors.startDate = 'Choose a valid start date.';
  if (!isValidFormDate(draft.endDate)) errors.endDate = 'Choose a valid end date.';
  if (!errors.startDate && !errors.endDate && draft.endDate < draft.startDate) {
    errors.endDate = 'End date cannot be before start date.';
  }
  if (draft.employeeNote.length > 2000) errors.employeeNote = 'Note must be 2000 characters or fewer.';
  return errors;
}