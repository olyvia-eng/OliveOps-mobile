import { describe, expect, it } from '@jest/globals';
import {
  buildFormResponses,
  formatFormDate,
  hasRequiredUnsupportedField,
  initialFormValues,
  localCalendarDate,
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

  it('normalizes supported defaults into canonical answer values', () => {
    const fields = [
      field({ id: 'short', type: 'single_line_text', label: 'Short', defaultValue: '  Jane Smith  ' }),
      field({ id: 'long', type: 'multi_line_text', label: 'Long', defaultValue: ' Notes ' }),
      field({ id: 'number', type: 'number', label: 'Number', defaultValue: 0 as any }),
      field({ id: 'date', type: 'date', label: 'Date', defaultValue: '2026-08-25' }),
      field({ id: 'time', type: 'time', label: 'Time', defaultValue: '07:30' }),
      field({ id: 'yes', type: 'yes_no', label: 'Yes', defaultValue: true as any }),
      field({ id: 'no', type: 'yes_no', label: 'No', defaultValue: false as any }),
      field({ id: 'check', type: 'checkbox', label: 'Check', options: ['Checked'], defaultValue: 'Checked' }),
      field({ id: 'drop', type: 'dropdown', label: 'Drop', options: ['A'], defaultValue: 'A' }),
      field({ id: 'multiple', type: 'multiple_choice', label: 'Multiple', options: ['Good'], defaultValue: 'Good' }),
      field({ id: 'driver', type: 'employee_selector', label: 'Driver', choices: [{ value: 'emp-1', label: 'Jane Smith' }], defaultValue: 'Jane Smith' }),
    ];

    expect(initialFormValues(fields, {}, new Date(2026, 7, 19, 12))).toEqual({
      short: 'Jane Smith', long: 'Notes', number: '0', date: '2026-08-25', time: '07:30',
      yes: 'yes', no: 'no', check: 'Checked', drop: 'A', multiple: 'Good', driver: 'emp-1',
    });
  });

  it('uses existing answers before defaults and local today without overwriting blanks', () => {
    const fields = [
      field({ id: 'date', type: 'date', label: 'Date', defaultValue: '2026-08-25' }),
      field({ id: 'driver', type: 'single_line_text', label: 'Driver', defaultValue: 'Jane Smith' }),
      field({ id: 'today', type: 'date', label: 'Today' }),
    ];
    expect(initialFormValues(fields, { date: '2026-08-27', driver: '', today: '2026-08-28' }, new Date(2026, 7, 19, 12))).toEqual({
      date: '2026-08-27', driver: '', today: '2026-08-28',
    });
  });

  it('uses local calendar components for today and safely replaces malformed date defaults', () => {
    const localDate = new Date(2026, 7, 19, 23, 30);
    const dateField = field({ id: 'date', type: 'date', label: 'Date', required: true, defaultValue: '2026-02-30' });
    expect(localCalendarDate(localDate)).toBe('2026-08-19');
    expect(initialFormValues([dateField], {}, localDate)).toEqual({ date: '2026-08-19' });
    expect(formatFormDate('not-a-date')).toBe('Choose a date');
    expect(validateFormValues([dateField], { date: '2026-08-19' })).toEqual({});
  });

  it('uses the business-local date for automatic date defaults', () => {
    const dateField = field({ id: 'date', type: 'date', label: 'Date' });
    const utcBoundary = new Date('2026-08-20T02:30:00.000Z');
    expect(initialFormValues([dateField], {}, utcBoundary, 'America/Toronto')).toEqual({ date: '2026-08-19' });
    expect(initialFormValues([dateField], {}, utcBoundary, 'Pacific/Auckland')).toEqual({ date: '2026-08-20' });
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
      date: 'Choose a valid date.',
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

  it('accepts canonical No and numeric zero but rejects whitespace and blank defaults', () => {
    const fields = [
      field({ id: 'no', type: 'yes_no', label: 'No', required: true }),
      field({ id: 'zero', type: 'number', label: 'Zero', required: true }),
      field({ id: 'blank', type: 'single_line_text', label: 'Blank', required: true, defaultValue: '   ' }),
    ];
    const values = initialFormValues(fields, { no: 'no', zero: '0' });
    expect(validateFormValues(fields, values)).toEqual({ blank: 'This field is required.' });
    expect(buildFormResponses(fields, values)).toEqual([
      { fieldId: 'no', value: 'no' },
      { fieldId: 'zero', value: '0' },
    ]);
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