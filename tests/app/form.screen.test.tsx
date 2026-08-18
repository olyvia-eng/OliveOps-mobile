import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSubmitForm = jest.fn();
const mockRefreshForms = jest.fn().mockResolvedValue({ ok: true });
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

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

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ list: 'todo', formId: 'form-1', trigger: 'daily', equipmentId: 'eq-1' }),
  useNavigation: () => ({ addListener: mockAddListener, dispatch: mockDispatch }),
}));
jest.mock('@/store/formsStore', () => ({
  useFormsStore: () => ({ toDo: [mockForm], available: [] }),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { businessId: 'biz-1', id: 'user-1', employeeId: 'emp-1' } }),
}));
jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms, submitForm: mockSubmitForm, submitting: false }),
}));
jest.mock('@/services/requestGuards', () => ({
  createRequestMeta: () => ({ requestId: 'form-request-1', idempotencyKey: 'form-submission-1' }),
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message }: any) => require('react').createElement('status-banner', { message }) }));
jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, disabled, onPress }: any) => require('react').createElement('primary-button', { label, disabled, onPress }),
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
    mockSubmitForm.mockReset().mockResolvedValue({ ok: true, submission: { id: 'sub-1' } });
    mockRefreshForms.mockClear();
    mockReplace.mockClear();
    mockAddListener.mockClear();
    mockForm.fields[3].required = false;
  });

  it('blocks missing required fields locally', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('This field is required.');
  });

  it('submits exact trimmed responses and context, then returns to Forms', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('  Good  '));
    await act(async () => tree.root.findByProps({ testID: 'form-field-damage-option-no' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).toHaveBeenCalledWith({
      clientSubmissionId: 'form-submission-1',
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
    expect(mockSubmitForm.mock.calls[0][0].clientSubmissionId).toBe('form-submission-1');
    expect(mockSubmitForm.mock.calls[1][0].clientSubmissionId).toBe('form-submission-1');
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
});