import type { EmployeeFormField, EmployeeFormResponse } from '@/types/forms';
import { businessDateKey } from '@/utils/businessTime';

export type EmployeeFormValues = Record<string, string>;
export type EmployeeFormFieldErrors = Record<string, string>;

const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const DISPLAY_FIELD_TYPES = new Set(['section_header', 'paragraph_text']);
export const UNSUPPORTED_FIELD_TYPES = new Set(['signature', 'file_upload']);
const ACCEPTED_RESPONSE_FIELD_TYPES = new Set(['yes_no', 'checkbox', 'multiple_choice', 'dropdown']);
export const ACCEPTED_RESPONSE_FALLBACK = 'Your response does not meet the requirement for this question.';

export function isValidFormDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export function localCalendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromCanonicalValue(value: string) {
  if (!isValidFormDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatFormDate(value: string) {
  const date = dateFromCanonicalValue(value);
  return date?.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) ?? 'Choose a date';
}

function normalizeInitialValue(field: EmployeeFormField, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
  const normalized = String(value).trim();
  if (!normalized) return '';
  if (field.type === 'single_line_text' || field.type === 'multi_line_text') return normalized;
  if (field.type === 'number' || field.type === 'currency') {
    return NUMBER_PATTERN.test(normalized) && Number.isFinite(Number(normalized)) ? normalized : '';
  }
  if (field.type === 'date') return isValidFormDate(normalized) ? normalized : '';
  if (field.type === 'time') return TIME_PATTERN.test(normalized) ? normalized : '';
  if (field.type === 'yes_no') {
    if (normalized === 'yes' || normalized === 'true') return 'yes';
    if (normalized === 'no' || normalized === 'false') return 'no';
    return '';
  }
  if (['checkbox', 'multiple_choice', 'dropdown'].includes(field.type)) {
    return (field.options ?? []).includes(normalized) ? normalized : '';
  }
  if (['employee_selector', 'job_selector', 'customer_selector'].includes(field.type)) {
    const choice = (field.choices ?? []).find((item) => item.value === normalized || item.label === normalized);
    return choice?.value ?? '';
  }
  return '';
}

export function initialFormValues(
  fields: EmployeeFormField[],
  existingValues: EmployeeFormValues = {},
  today = new Date(),
  timeZone?: string | null,
) {
  return fields.reduce<EmployeeFormValues>((values, field) => {
    if (DISPLAY_FIELD_TYPES.has(field.type) || UNSUPPORTED_FIELD_TYPES.has(field.type)) return values;
    if (Object.prototype.hasOwnProperty.call(existingValues, field.id)) {
      values[field.id] = existingValues[field.id];
      return values;
    }
    const defaultValue = normalizeInitialValue(field, field.defaultValue);
    if (defaultValue) values[field.id] = defaultValue;
    else if (field.type === 'date') values[field.id] = businessDateKey(today, timeZone);
    return values;
  }, { ...existingValues });
}

export function hasRequiredUnsupportedField(fields: EmployeeFormField[]) {
  return fields.some((field) => field.required && UNSUPPORTED_FIELD_TYPES.has(field.type));
}

export function validateFormValues(fields: EmployeeFormField[], values: EmployeeFormValues) {
  const errors: EmployeeFormFieldErrors = {};

  for (const field of fields) {
    if (DISPLAY_FIELD_TYPES.has(field.type) || UNSUPPORTED_FIELD_TYPES.has(field.type)) continue;
    const value = (values[field.id] ?? '').trim();

    if (field.required && !value) {
      errors[field.id] = 'This field is required.';
      continue;
    }
    if (!value) continue;

    if (field.type === 'single_line_text' && value.length > 500) {
      errors[field.id] = 'Enter 500 characters or fewer.';
    } else if (field.type === 'multi_line_text' && value.length > 10_000) {
      errors[field.id] = 'Enter 10,000 characters or fewer.';
    } else if ((field.type === 'number' || field.type === 'currency')
      && (!NUMBER_PATTERN.test(value) || !Number.isFinite(Number(value)))) {
      errors[field.id] = 'Enter a valid number.';
    } else if (field.type === 'date' && !isValidFormDate(value)) {
      errors[field.id] = 'Choose a valid date.';
    } else if (field.type === 'time' && !TIME_PATTERN.test(value)) {
      errors[field.id] = 'Enter a valid time as HH:MM.';
    } else if (field.type === 'yes_no' && value !== 'yes' && value !== 'no') {
      errors[field.id] = 'Choose Yes or No.';
    } else if (['checkbox', 'multiple_choice', 'dropdown'].includes(field.type)
      && !(field.options ?? []).includes(value)) {
      errors[field.id] = 'Choose one of the available options.';
    } else if (['employee_selector', 'job_selector', 'customer_selector'].includes(field.type)
      && !(field.choices ?? []).some((choice) => choice.value === value)) {
      errors[field.id] = 'Choose one of the available options.';
    }

    if (!errors[field.id]
      && field.acceptedResponse
      && ACCEPTED_RESPONSE_FIELD_TYPES.has(field.type)
      && value !== field.acceptedResponse.value.trim()) {
      errors[field.id] = field.acceptedResponse.message?.trim() || ACCEPTED_RESPONSE_FALLBACK;
    }
  }

  return errors;
}

export function buildFormResponses(fields: EmployeeFormField[], values: EmployeeFormValues) {
  return fields.reduce<EmployeeFormResponse[]>((responses, field) => {
    if (DISPLAY_FIELD_TYPES.has(field.type) || UNSUPPORTED_FIELD_TYPES.has(field.type) || field.type === 'photo_upload') return responses;
    const value = (values[field.id] ?? '').trim();
    if (value) responses.push({ fieldId: field.id, value });
    return responses;
  }, []);
}