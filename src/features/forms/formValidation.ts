import type { EmployeeFormField, EmployeeFormResponse } from '@/types/forms';

export type EmployeeFormValues = Record<string, string>;
export type EmployeeFormFieldErrors = Record<string, string>;

const NUMBER_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const DISPLAY_FIELD_TYPES = new Set(['section_header', 'paragraph_text']);
export const UNSUPPORTED_FIELD_TYPES = new Set(['signature', 'photo_upload', 'file_upload']);

function isValidDate(value: string) {
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

export function initialFormValues(fields: EmployeeFormField[]) {
  return fields.reduce<EmployeeFormValues>((values, field) => {
    if (!DISPLAY_FIELD_TYPES.has(field.type) && !UNSUPPORTED_FIELD_TYPES.has(field.type) && field.defaultValue) {
      values[field.id] = field.defaultValue;
    }
    return values;
  }, {});
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
    } else if (field.type === 'date' && !isValidDate(value)) {
      errors[field.id] = 'Enter a valid date as YYYY-MM-DD.';
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
  }

  return errors;
}

export function buildFormResponses(fields: EmployeeFormField[], values: EmployeeFormValues) {
  return fields.reduce<EmployeeFormResponse[]>((responses, field) => {
    if (DISPLAY_FIELD_TYPES.has(field.type) || UNSUPPORTED_FIELD_TYPES.has(field.type)) return responses;
    const value = (values[field.id] ?? '').trim();
    if (value) responses.push({ fieldId: field.id, value });
    return responses;
  }, []);
}