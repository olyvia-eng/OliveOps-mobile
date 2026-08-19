import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('date-picker', props),
}));

const mockSubmitForm = jest.fn();
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockCompleteCurrentForm = jest.fn();
let mockWorkflow: any = null;
let mockParams: any = { list: 'todo', formId: 'form-1', trigger: 'daily', equipmentId: 'eq-1' };

const mockForm: any = {
  id: 'form-1',
  name: 'Daily Equipment Inspection',
  description: 'Inspect before use',
  trigger: 'daily',
  required: true,
  context: { equipmentId: 'eq-1', equipmentName: 'Bobcat E50' },
  fields: [
    { id: 'condition', type: 'single_line_text', label: 'Condition', required: true, order: 1 },
    { id: 'notes', type: 'multi_line_text', label: 'Notes', required: false, order: 2 },
    { id: 'damage', type: 'yes_no', label: 'Visible damage', required: false, order: 3 },
    { id: 'photo', type: 'photo_upload', label: 'Photo', required: false, order: 4 },
  ],
  submissionState: { completed: false },
};
const defaultFields = mockForm.fields;

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ addListener: mockAddListener, dispatch: mockDispatch }),
}));
jest.mock('@/store/formsStore', () => ({
  useFormsStore: () => ({ toDo: [mockForm], available: [] }),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { businessId: 'biz-1', id: 'user-1', employeeId: 'emp-1' } }),
}));
jest.mock('@/store/formsWorkflowStore', () => ({
  useFormsWorkflowStore: () => ({ workflow: mockWorkflow, completeCurrentForm: mockCompleteCurrentForm }),
}));
jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms, submitForm: mockSubmitForm, submitting: false }),
}));
jest.mock('@/services/requestGuards', () => ({
  createFormClientSubmissionId: () => 'form-submission:request-1',
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }) }));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) => require('react').createElement('primary-button', { label, disabled, onPress }),
}));
jest.mock('@/components/SecondaryButton', () => ({
  SecondaryButton: ({ label, onPress }: any) => require('react').createElement('secondary-button', { label, onPress }),
}));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    TurboModuleRegistry: { get: () => null },
    Alert: { alert: jest.fn() },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    TextInput: (props: any) => ReactModule.createElement('textinput', props),
    Pressable: ({ children, onPress, ...props }: any) => ReactModule.createElement('pressable', { onPress, ...props }, typeof children === 'function' ? children({ pressed: false }) : children),
  };
});

import FormScreen from '../../app/form';
import { Alert } from 'react-native';

describe('FormScreen', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockSubmitForm.mockReset().mockResolvedValue({ ok: true, submission: { id: 'sub-1' } });
    mockRefreshForms.mockClear();
    mockReplace.mockClear();
    mockCompleteCurrentForm.mockClear();
    mockWorkflow = null;
    mockParams = { list: 'todo', formId: 'form-1', trigger: 'daily', equipmentId: 'eq-1' };
    mockAddListener.mockClear();
    mockForm.name = 'Daily Equipment Inspection';
    mockForm.fields = defaultFields;
    mockForm.fields[3].required = false;
  });

  it('blocks missing required fields locally', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('This field is required.');
  });

  it('submits exact trimmed responses and shows confirmation before returning to Forms', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('  Good  '));
    await act(async () => tree.root.findByProps({ testID: 'form-field-damage-option-no' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).toHaveBeenCalledWith({
      clientSubmissionId: 'form-submission:request-1',
      formId: 'form-1',
      trigger: 'daily',
      equipmentId: 'eq-1',
      jobId: undefined,
      divisionId: undefined,
      responses: [
        { fieldId: 'condition', value: 'Good' },
        { fieldId: 'damage', value: 'no' },
      ],
    });
    expect(mockReplace).not.toHaveBeenCalled();
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Form submitted');
    expect(text).toContain('Daily Equipment Inspection has been submitted successfully.');
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockReplace).toHaveBeenCalledWith('/forms');
  });

  it('preserves entered values and offers the same submit action after failure', async () => {
    mockSubmitForm.mockResolvedValue({ ok: false, error: 'Could not submit this form. Your answers are still here.' });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    const input = tree.root.findByProps({ testID: 'form-field-condition' });
    await act(async () => input.props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Good');
    expect(tree.root.findByType('primary-button').props.label).toBe('Retry Submit');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('advances a workflow Form and returns to its originating action after success', async () => {
    mockParams = { list: 'todo', formId: 'form-1', trigger: 'daily', equipmentId: 'eq-1', workflowId: 'workflow-1' };
    mockWorkflow = {
      id: 'workflow-1', originRoute: '/clock-in', destination: '/active-shift', phase: 'pre_action', completedCount: 0,
      intent: { kind: 'clock_in', employeeId: 'emp-1', workType: 'job', jobIds: ['job-1'] },
      forms: [mockForm],
    };
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockCompleteCurrentForm).toHaveBeenCalledWith('workflow-1');
    expect(mockReplace).toHaveBeenCalledWith('/clock-in');
    expect(tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ')).not.toContain('Form submitted');
  });

  it('reuses the same client submission ID for an explicit retry', async () => {
    mockSubmitForm
      .mockResolvedValueOnce({ ok: false, error: 'Submission could not be confirmed.', uncertain: true })
      .mockResolvedValueOnce({ ok: true, submission: { id: 'sub-1' } });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).toHaveBeenCalledTimes(2);
    expect(mockSubmitForm.mock.calls[0][0].clientSubmissionId).toBe('form-submission:request-1');
    expect(mockSubmitForm.mock.calls[1][0].clientSubmissionId).toBe('form-submission:request-1');
  });

  it('disables submission when a required unsupported field exists', async () => {
    mockForm.fields[3].required = true;
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    const messages = tree.root.findAllByType('status-banner').map((node: any) => node.props.message);
    expect(messages.join(' ')).toContain('newer mobile Forms version');
  });

  it('warns before leaving only after answers have changed', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));

    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array));
  });

  it('submits Morning Truck Inspection with hydrated Date, Driver, and Yes answers', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 19, 23, 30));
    mockForm.name = 'Morning Truck Inspection';
    mockForm.fields = [
      { id: 'inspection-date', type: 'date', label: 'Inspection Date', required: true, order: 1 },
      {
        id: 'driver', type: 'employee_selector', label: 'Driver', required: true, order: 2,
        defaultValue: 'Jane Smith', choices: [{ value: 'emp-jane', label: 'Jane Smith' }],
      },
      { id: 'lights', type: 'yes_no', label: 'Lights and signals working?', required: true, order: 3 },
      { id: 'notes', type: 'multi_line_text', label: 'Notes / Deficiencies', required: false, order: 4 },
    ];
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });

    expect(tree.root.findByProps({ testID: 'form-field-inspection-date' }).props.accessibilityLabel).toContain('Aug 19, 2026');
    expect(tree.root.findByProps({ testID: 'form-field-driver-option-emp-jane' }).props.accessibilityState.selected).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'form-field-lights-option-yes' }).props.onPress());
    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Form').props.onPress());

    expect(mockSubmitForm).toHaveBeenCalledWith(expect.objectContaining({
      responses: [
        { fieldId: 'inspection-date', value: '2026-08-19' },
        { fieldId: 'driver', value: 'emp-jane' },
        { fieldId: 'lights', value: 'yes' },
      ],
    }));
    jest.useRealTimers();
  });

  it('keeps an edited date through rerenders and failed submission', async () => {
    mockForm.fields = [
      { id: 'inspection-date', type: 'date', label: 'Inspection Date', required: true, order: 1, defaultValue: '2026-08-19' },
      { id: 'notes', type: 'single_line_text', label: 'Notes', required: false, order: 2 },
    ];
    mockSubmitForm.mockResolvedValue({ ok: false, error: 'Submission could not be confirmed.', uncertain: true });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-inspection-date' }).props.onPress());
    await act(async () => tree.root.findByType('date-picker').props.onChange({ type: 'set' }, new Date(2026, 7, 25, 12)));
    await act(async () => tree.root.findByProps({ testID: 'form-field-notes' }).props.onChangeText('Checked'));
    expect(tree.root.findByProps({ testID: 'form-field-inspection-date' }).props.accessibilityLabel).toContain('Aug 25, 2026');

    await act(async () => tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Submit Form').props.onPress());
    expect(tree.root.findByProps({ testID: 'form-field-inspection-date' }).props.accessibilityLabel).toContain('Aug 25, 2026');
    expect(mockSubmitForm.mock.calls[0][0].responses).toContainEqual({ fieldId: 'inspection-date', value: '2026-08-25' });
  });

  it('places a structured server validation error beneath the identified field', async () => {
    mockSubmitForm.mockResolvedValue({
      ok: false,
      error: 'Some answers need attention before this form can be submitted.',
      fieldErrors: { condition: 'Check this answer and try again.' },
    });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Check this answer and try again.');
  });
});