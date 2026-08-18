import { describe, expect, it } from '@jest/globals';
import {
  buildFormResponses,
  hasRequiredUnsupportedField,
  initialFormValues,
  validateFormValues,
} from '@/features/forms/formValidation';
import type { EmployeeFormField } from '@/types/forms';

function field(overrides: Partial<EmployeeFormField> & Pick<EmployeeFormField, 'id' | 'type' | 'label'>): EmployeeFormField {
  return { required: false, order: 1, ...overrides };
}

describe('formValidation', () => {
  it('initializes safe defaults and omits display and unsupported fields', () => {
    const fields = [
      field({ id: 'text', type: 'single_line_text', label: 'Text', defaultValue: 'Default' }),
      field({ id: 'display', type: 'paragraph_text', label: 'Display', defaultValue: 'Ignore' }),
      field({ id: 'photo', type: 'photo_upload', label: 'Photo', defaultValue: 'Ignore' }),
    ];
    expect(initialFormValues(fields)).toEqual({ text: 'Default' });
  });

  it('validates required text and contract length limits', () => {
    const fields = [
      field({ id: 'short', type: 'single_line_text', label: 'Short', required: true }),
      field({ id: 'long', type: 'multi_line_text', label: 'Long' }),
    ];
    expect(validateFormValues(fields, { short: ' ', long: 'a'.repeat(10_001) })).toEqual({
      short: 'This field is required.',
      long: 'Enter 10,000 characters or fewer.',
    });
  });

  it('validates numbers, dates, times, yes/no, options, and authorized choices', () => {
    const fields = [
      field({ id: 'number', type: 'number', label: 'Number' }),
      field({ id: 'currency', type: 'currency', label: 'Currency' }),
      field({ id: 'date', type: 'date', label: 'Date' }),
      field({ id: 'time', type: 'time', label: 'Time' }),
      field({ id: 'yesno', type: 'yes_no', label: 'Yes No' }),
      field({ id: 'choice', type: 'multiple_choice', label: 'Choice', options: ['Good'] }),
      field({ id: 'job', type: 'job_selector', label: 'Job', choices: [{ value: 'job-1', label: 'Shoreline' }] }),
    ];
    expect(validateFormValues(fields, {
      number: 'zero',
      currency: '12.50.2',
      date: '2026-02-30',
      time: '25:00',
      yesno: 'maybe',
      choice: 'Bad',
      job: 'job-2',
    })).toEqual({
      number: 'Enter a valid number.',
      currency: 'Enter a valid number.',
      date: 'Enter a valid date as YYYY-MM-DD.',
      time: 'Enter a valid time as HH:MM.',
      yesno: 'Choose Yes or No.',
      choice: 'Choose one of the available options.',
      job: 'Choose one of the available options.',
    });
  });

  it('accepts valid contract values and builds trimmed responses', () => {
    const fields = [
      field({ id: 'text', type: 'single_line_text', label: 'Text', required: true }),
      field({ id: 'number', type: 'number', label: 'Number' }),
      field({ id: 'date', type: 'date', label: 'Date' }),
      field({ id: 'time', type: 'time', label: 'Time' }),
      field({ id: 'yesno', type: 'yes_no', label: 'Yes No' }),
      field({ id: 'checkbox', type: 'checkbox', label: 'Checkbox', options: ['Checked'] }),
      field({ id: 'dropdown', type: 'dropdown', label: 'Dropdown', options: ['A'] }),
      field({ id: 'employee', type: 'employee_selector', label: 'Employee', choices: [{ value: 'emp-1', label: 'Alex' }] }),
      field({ id: 'section', type: 'section_header', label: 'Section' }),
    ];
    const values = { text: '  done  ', number: '.5', date: '2026-08-18', time: '07:04', yesno: 'no', checkbox: 'Checked', dropdown: 'A', employee: 'emp-1' };
    expect(validateFormValues(fields, values)).toEqual({});
    expect(buildFormResponses(fields, values)).toContainEqual({ fieldId: 'text', value: 'done' });
    expect(buildFormResponses(fields, values)).not.toContainEqual(expect.objectContaining({ fieldId: 'section' }));
  });

  it('blocks required signature, photo, and file fields without submitting them', () => {
    const fields = [
      field({ id: 'signature', type: 'signature', label: 'Signature', required: true }),
      field({ id: 'photo', type: 'photo_upload', label: 'Photo', required: false }),
      field({ id: 'file', type: 'file_upload', label: 'File', required: false }),
    ];
    expect(hasRequiredUnsupportedField(fields)).toBe(true);
    expect(buildFormResponses(fields, { signature: 'Alex', photo: 'local-uri', file: 'file-id' })).toEqual([]);
  });
});