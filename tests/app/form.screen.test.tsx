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
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPush = jest.fn();
const mockDispatch = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockCompleteCurrentForm = jest.fn();
const mockRefreshWorkContext = jest.fn().mockResolvedValue({ ok: true });
const mockSubmissionIdFor = jest.fn().mockResolvedValue('form-submission:required-1');
const mockQueueSubmission = jest.fn().mockResolvedValue(undefined);
const mockRecoverPending = jest.fn().mockResolvedValue(null);
const mockRefreshAfterSubmission = jest.fn().mockResolvedValue(null);
const mockFinalize = jest.fn().mockResolvedValue({ ok: true });
const mockInitialFormValues = jest.fn();
const mockLoadFormAttachments = jest.fn().mockResolvedValue([]);
const mockPrepareFormSubmissionAttachments = jest.fn(async (payload) => payload);
const mockMarkFormAttachmentsSubmitted = jest.fn().mockResolvedValue(undefined);
const mockRebindFormAttachments = jest.fn().mockResolvedValue([]);
const mockPickSinglePhoto = jest.fn();
let mockPendingClockOut: any;
let mockPendingClockIn: any;
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
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ addListener: mockAddListener, dispatch: mockDispatch }),
}));
jest.mock('@/store/formsStore', () => ({
  useFormsStore: () => ({ toDo: [mockForm], available: [] }),
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ accessToken: 'token-1', user: { businessId: 'biz-1', id: 'user-1', employeeId: 'emp-1' } }),
}));
jest.mock('@/store/clockingStore', () => ({
  useClockingStore: () => ({ businessTimeZone: 'America/Toronto' }),
}));
jest.mock('@/store/formsWorkflowStore', () => ({
  useFormsWorkflowStore: () => ({ workflow: mockWorkflow, completeCurrentForm: mockCompleteCurrentForm }),
}));
jest.mock('@/hooks/useFormsActions', () => ({
  useFormsActions: () => ({ refreshForms: mockRefreshForms, submitForm: mockSubmitForm, submitting: false }),
}));
jest.mock('@/hooks/useClockingActions', () => ({
  useClockingActions: () => ({ refreshWorkContext: mockRefreshWorkContext }),
}));
jest.mock('@/services/connectivity', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/store/pendingClockOutStore', () => ({
  usePendingClockOutStore: () => mockPendingClockOut,
  requirementForm: (requirement: any) => requirement?.form ?? null,
  workflowRequirements: (workflow: any) => workflow?.requirements ?? [],
}));
jest.mock('@/store/pendingClockInStore', () => ({
  usePendingClockInStore: () => mockPendingClockIn,
  pendingClockInRequirementForm: (requirement: any) => requirement?.form ?? null,
}));
jest.mock('@/services/requestGuards', () => ({
  createFormClientSubmissionId: () => 'form-submission:request-1',
}));
jest.mock('@/services/formAttachmentStorage', () => ({
  createDurableFormPhoto: jest.fn(),
  ensureFormPhotoUploaded: jest.fn(),
  loadFormAttachments: (...args: unknown[]) => mockLoadFormAttachments(...args),
  markFormAttachmentsSubmitted: (...args: unknown[]) => mockMarkFormAttachmentsSubmitted(...args),
  prepareFormSubmissionAttachments: (...args: unknown[]) => mockPrepareFormSubmissionAttachments(...args),
  rebindFormAttachments: (...args: unknown[]) => mockRebindFormAttachments(...args),
  removeFormAttachment: jest.fn(),
}));
jest.mock('@/services/photoPicker', () => ({
  pickSinglePhoto: (...args: unknown[]) => mockPickSinglePhoto(...args),
}));
jest.mock('@/features/forms/formValidation', () => {
  const actual = jest.requireActual('@/features/forms/formValidation') as any;
  return {
    ...actual,
    initialFormValues: (...args: any[]) => {
      mockInitialFormValues(...args);
      return actual.initialFormValues(...args);
    },
  };
});
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
    Image: (props: any) => ReactModule.createElement('image', props),
    ActivityIndicator: (props: any) => ReactModule.createElement('activity-indicator', props),
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
    mockBack.mockClear();
    mockDismissTo.mockClear();
    mockPush.mockClear();
    mockCompleteCurrentForm.mockClear();
    mockWorkflow = null;
    mockPendingClockOut = {
      workflow: null,
      currentRequirement: null,
      busy: false,
      submissionIdFor: mockSubmissionIdFor,
      queueSubmission: mockQueueSubmission,
      recover: mockRecoverPending,
      refreshAfterSubmission: mockRefreshAfterSubmission,
      finalize: mockFinalize,
    };
    mockPendingClockIn = {
      workflow: null,
      currentRequirement: null,
      busy: false,
      submissionIdFor: mockSubmissionIdFor,
      queueSubmission: mockQueueSubmission,
      recover: mockRecoverPending,
      refreshAfterSubmission: mockRefreshAfterSubmission,
      finalize: mockFinalize,
    };
    mockSubmissionIdFor.mockClear();
    mockQueueSubmission.mockClear();
    mockRecoverPending.mockClear();
    mockRefreshAfterSubmission.mockReset().mockResolvedValue(null);
    mockFinalize.mockReset().mockResolvedValue({ ok: true });
    mockRefreshWorkContext.mockClear();
    mockInitialFormValues.mockClear();
    mockLoadFormAttachments.mockReset().mockResolvedValue([]);
    mockPrepareFormSubmissionAttachments.mockReset().mockImplementation(async (payload) => payload);
    mockMarkFormAttachmentsSubmitted.mockClear();
    mockRebindFormAttachments.mockReset().mockResolvedValue([]);
    mockPickSinglePhoto.mockReset();
    mockParams = { list: 'todo', formId: 'form-1', trigger: 'daily', equipmentId: 'eq-1' };
    mockAddListener.mockClear();
    mockForm.name = 'Daily Equipment Inspection';
    mockForm.fields = defaultFields;
    mockForm.fields[3].required = false;
    mockForm.fields.forEach((field: any) => { delete field.acceptedResponse; });
  });

  it('blocks missing required fields locally', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('This field is required.');
  });

  it('blocks a known rejected response locally without submitting', async () => {
    mockForm.fields = [{
      id: 'fit', type: 'yes_no', label: 'Fit for work?', required: true, order: 1,
      acceptedResponse: { value: 'yes', message: 'Contact your supervisor.' },
    }];
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-fit-option-no' }).props.onPress());
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Contact your supervisor.');
  });

  it('restores queued mandatory answers and the server rejection after recovery', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
      queuedSubmissionFor: () => ({ responses: [{ fieldId: 'condition', value: 'Queued answer' }] }),
      submissionFailure: {
        workflowRequirementId: 'requirement-1', code: 'form_response_requirement_failed',
        error: 'Contact your supervisor.', fieldId: 'condition',
      },
    };

    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });

    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Queued answer');
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Contact your supervisor.');
    expect(mockFinalize).not.toHaveBeenCalled();
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
    expect(mockDismissTo).toHaveBeenCalledWith('/forms');
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
    const clockInContext = tree.root.findByProps({ testID: 'clock-in-form-context' });
    const contextText = clockInContext.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(contextText).toContain('Clock In');
    expect(contextText).toContain('Forms');
    expect(contextText).toContain('Complete Required Form');
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockCompleteCurrentForm).toHaveBeenCalledWith('workflow-1');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
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

  it('submits mandatory clock-out workflow IDs and finalizes after the last requirement', async () => {
    const requiredForm = { ...mockForm, trigger: 'after_clock_out', context: { jobId: 'job-1' } };
    const requirement = { workflowRequirementId: 'requirement-1', completed: false, form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
    };
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).toHaveBeenCalledWith(expect.objectContaining({
      clientSubmissionId: 'form-submission:required-1',
      workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
      jobId: 'job-1',
    }));
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('status-banner').props.message).toBe('Clock-out submitted successfully.');
  });

  it('submits requirementId as workflowRequirementId and finalizes mandatory clock-in', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in', context: { jobId: 'job-1' } };
    const requirement = { requirementId: 'clock-in-requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
      workflowRequirementId: 'clock-in-requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    expect(tree.root.findByProps({ testID: 'clock-in-form-context' })).toBeTruthy();
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).toHaveBeenCalledWith(expect.objectContaining({
      clientSubmissionId: 'form-submission:required-1',
      workflowOccurrenceId: 'clock-in-occurrence-1',
      workflowRequirementId: 'clock-in-requirement-1',
      formId: 'form-1',
    }));
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
    expect(tree.root.findAllByProps({ label: 'View Active Shift' })).toHaveLength(0);
  });

  it('keeps the first mandatory clock-in occurrence snapshot and values through store reconciliation', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    const capturedForm = {
      ...mockForm,
      name: 'Captured Inspection',
      trigger: 'before_clock_in',
      fields: [{ ...mockForm.fields[0], label: 'Captured condition', defaultValue: 'Initial' }],
    };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: capturedForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };

    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    expect(mockInitialFormValues).toHaveBeenCalledTimes(1);
    expect(mockRefreshForms).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Employee entry'));

    const replacementForm = {
      ...capturedForm,
      name: 'Replacement Inspection',
      fields: [{ ...capturedForm.fields[0], label: 'Replacement condition', defaultValue: 'Replacement' }],
    };
    const replacementRequirement = { ...requirement, form: replacementForm };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [replacementRequirement] },
      currentRequirement: replacementRequirement,
    };
    await act(async () => tree.update(<FormScreen />));

    let text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Captured Inspection');
    expect(text).toContain('Captured condition');
    expect(text).not.toContain('Replacement Inspection');
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Employee entry');
    expect(mockInitialFormValues).toHaveBeenCalledTimes(1);
    expect(mockRefreshForms).not.toHaveBeenCalled();

    mockPendingClockIn = { ...mockPendingClockIn, workflow: null, currentRequirement: null };
    await act(async () => tree.update(<FormScreen />));
    text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Captured Inspection');
    expect(text).not.toContain('Form unavailable');
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Employee entry');
    expect(mockRefreshForms).not.toHaveBeenCalled();

    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Clock in pending',
      'Complete this required form before clocking in.',
      expect.any(Array),
    );
  });

  it('captures a new mandatory snapshot and initial values when the route advances', async () => {
    const firstForm = {
      ...mockForm,
      name: 'First Inspection',
      trigger: 'before_clock_in',
      fields: [{ ...mockForm.fields[0], defaultValue: 'First default' }],
    };
    const first = { requirementId: 'requirement-1', formId: 'form-1', form: firstForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [first] },
      currentRequirement: first,
    };

    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('First default');

    const secondForm = {
      ...mockForm,
      id: 'form-2',
      name: 'Second Safety Check',
      trigger: 'before_clock_in',
      fields: [{ ...mockForm.fields[0], defaultValue: 'Second default' }],
    };
    const second = { requirementId: 'requirement-2', formId: 'form-2', form: secondForm };
    mockParams = {
      formId: 'form-2', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-2',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [second] },
      currentRequirement: second,
    };
    await act(async () => tree.update(<FormScreen />));

    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Second Safety Check');
    expect(text).not.toContain('First Inspection');
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Second default');
    expect(mockInitialFormValues).toHaveBeenCalledTimes(2);
    expect(mockRefreshForms).not.toHaveBeenCalled();
  });

  it('keeps the first mandatory clock-out snapshot through equivalent store updates', async () => {
    const capturedForm = { ...mockForm, name: 'Captured Clock Out Form', trigger: 'after_clock_out' };
    const requirement = { workflowRequirementId: 'requirement-1', completed: false, form: capturedForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
    };

    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Clock out entry'));
    const replacementForm = { ...capturedForm, name: 'Replacement Clock Out Form', fields: [...capturedForm.fields] };
    const replacementRequirement = { ...requirement, form: replacementForm };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [replacementRequirement] },
      currentRequirement: replacementRequirement,
    };
    await act(async () => tree.update(<FormScreen />));

    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Captured Clock Out Form');
    expect(text).not.toContain('Replacement Clock Out Form');
    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Clock out entry');
    expect(mockInitialFormValues).toHaveBeenCalledTimes(1);
    expect(mockRefreshForms).not.toHaveBeenCalled();
  });

  it('keeps ordinary Forms live outside mandatory workflow routes', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });

    mockForm.name = 'Updated Daily Inspection';
    await act(async () => tree.update(<FormScreen />));

    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Updated Daily Inspection');
    expect(text).not.toContain('Form unavailable');
  });

  it('stays on Finishing while successful clock-in finalization resolves with store busy false', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
      busy: false,
    };
    let resolveFinalize!: (result: { ok: true }) => void;
    mockFinalize.mockImplementationOnce(() => new Promise((resolve) => { resolveFinalize = resolve; }));
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => {
      tree.root.findByType('primary-button').props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    const finishingText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(finishingText).toContain('Required forms complete');
    expect(finishingText).toContain('Finishing clock in...');
    expect(tree.root.findAllByType('primary-button').some((node: any) => node.props.label === 'Retry Finish Clock In')).toBe(false);

    await act(async () => resolveFinalize({ ok: true }));

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
    expect(tree.root.findAllByProps({ label: 'View Active Shift' })).toHaveLength(0);
    expect(tree.root.findAllByType('primary-button').some((node: any) => node.props.label === 'Retry Finish Clock In')).toBe(false);
  });

  it('keeps the accepted clock-in form stable while its workflow clears during finalization', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
      busy: false,
    };
    let tree: any;
    let renderedDuringClear = '';
    mockFinalize.mockImplementationOnce(async () => {
      mockPendingClockIn = { ...mockPendingClockIn, workflow: null, currentRequirement: null };
      tree.update(<FormScreen />);
      renderedDuringClear = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
      const preventDefault = jest.fn();
      beforeRemove({ preventDefault, data: { action: { type: 'REPLACE' } } });
      expect(preventDefault).not.toHaveBeenCalled();
      return { ok: true };
    });

    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(renderedDuringClear).toContain('Daily Equipment Inspection');
    expect(renderedDuringClear).not.toContain('Form unavailable');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockSubmitForm).toHaveBeenCalledTimes(1);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
  });

  it('retries only clock-in finalization after the form submission was accepted', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
      busy: false,
    };
    mockFinalize
      .mockResolvedValueOnce({ ok: false, error: 'Clock-in could not be finalized. Your required form progress is still saved.' })
      .mockResolvedValueOnce({ ok: true });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(tree.root.findByType('primary-button').props.label).toBe('Retry Finish Clock In');
    const failureText = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(failureText).toContain('Required forms complete');
    expect(failureText).toContain("We couldn't finish clocking you in.");
    expect(failureText).not.toContain('Form unavailable');
    expect(mockPendingClockIn.workflow.workflowOccurrenceId).toBe('occurrence-1');
    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
    expect(preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).toHaveBeenCalledTimes(1);
    expect(mockFinalize).toHaveBeenCalledTimes(2);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
    expect(tree.root.findAllByProps({ label: 'View Active Shift' })).toHaveLength(0);
  });

  it('keeps the accepted clock-out form stable while its workflow clears during finalization', async () => {
    const requiredForm = { ...mockForm, trigger: 'after_clock_out' };
    const requirement = { workflowRequirementId: 'requirement-1', completed: false, form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
      busy: false,
    };
    let tree: any;
    let renderedDuringClear = '';
    mockFinalize.mockImplementationOnce(async () => {
      mockPendingClockOut = { ...mockPendingClockOut, workflow: null, currentRequirement: null };
      tree.update(<FormScreen />);
      renderedDuringClear = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
      return { ok: true };
    });

    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(renderedDuringClear).toContain('Daily Equipment Inspection');
    expect(renderedDuringClear).not.toContain('Form unavailable');
    expect(mockSubmitForm).toHaveBeenCalledTimes(1);
    expect(mockRefreshWorkContext).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('status-banner').props.message).toBe('Clock-out submitted successfully.');
  });

  it('stays on Finishing while successful clock-out finalization resolves with store busy false', async () => {
    const requiredForm = { ...mockForm, trigger: 'after_clock_out' };
    const requirement = { workflowRequirementId: 'requirement-1', completed: false, form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
      busy: false,
    };
    let resolveFinalize!: (result: { ok: true }) => void;
    mockFinalize.mockImplementationOnce(() => new Promise((resolve) => { resolveFinalize = resolve; }));
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => {
      tree.root.findByType('primary-button').props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('primary-button').props.label).toBe('Finishing...');
    expect(tree.root.findAllByType('primary-button').some((node: any) => node.props.label === 'Retry Finish Clock Out')).toBe(false);

    await act(async () => resolveFinalize({ ok: true }));

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('status-banner').props.message).toBe('Clock-out submitted successfully.');
    expect(tree.root.findAllByType('primary-button').some((node: any) => node.props.label === 'Retry Finish Clock Out')).toBe(false);
  });

  it('sequences multiple mandatory clock-in requirements before finalization', async () => {
    const firstForm = { ...mockForm, trigger: 'before_clock_in' };
    const secondForm = { ...mockForm, id: 'form-2', name: 'Safety Check', trigger: 'before_clock_in' };
    const first = { requirementId: 'requirement-1', formId: 'form-1', form: firstForm };
    const second = { requirementId: 'requirement-2', formId: 'form-2', form: secondForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1', remainingForms: [first, second] },
      currentRequirement: first,
    };
    mockRefreshAfterSubmission.mockResolvedValue({
      workflowOccurrenceId: 'clock-in-occurrence-1',
      remainingForms: [second],
    });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/form',
      params: {
        formId: 'form-2', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
        workflowRequirementId: 'requirement-2',
      },
    });
    expect(mockFinalize).not.toHaveBeenCalled();

    mockParams = {
      formId: 'form-2', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
      workflowRequirementId: 'requirement-2',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1', remainingForms: [second] },
      currentRequirement: second,
    };
    mockRefreshAfterSubmission.mockResolvedValue(null);
    await act(async () => tree.update(<FormScreen />));
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Safe'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).toHaveBeenCalledTimes(2);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
  });

  it('routes to the next server requirement instead of finalizing early', async () => {
    const firstForm = { ...mockForm, trigger: 'after_clock_out' };
    const secondForm = { ...mockForm, id: 'form-2', name: 'Equipment Check', trigger: 'after_clock_out' };
    const first = { workflowRequirementId: 'requirement-1', completed: false, form: firstForm };
    const second = { workflowRequirementId: 'requirement-2', completed: false, form: secondForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [first] },
      currentRequirement: first,
    };
    mockRefreshAfterSubmission.mockResolvedValue({
      workflowOccurrenceId: 'occurrence-1',
      requirements: [{ ...first, completed: true }, second],
    });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/form',
      params: {
        formId: 'form-2', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
        workflowRequirementId: 'requirement-2',
      },
    });
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('disables submission when a required unsupported field exists', async () => {
    mockForm.fields[3] = { ...mockForm.fields[3], type: 'file_upload', required: true };
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    expect(tree.root.findByType('primary-button').props.disabled).toBe(true);
    const messages = tree.root.findAllByType('status-banner').map((node: any) => node.props.message);
    expect(messages.join(' ')).toContain('newer mobile Forms version');
  });

  it('requires a Photo Upload locally and submits exactly one completed file ID', async () => {
    mockForm.fields[3] = { ...mockForm.fields[3], type: 'photo_upload', required: true };
    const attachment = {
      localAttachmentId: 'local-photo-1', identityKey: 'biz-1:user-1:emp-1', clientSubmissionId: 'form-submission:request-1',
      formId: 'form-1', fieldId: 'photo', localUri: 'file:///durable/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg',
      sizeBytes: 1024, state: 'completed', fileId: 'file-1', createdAt: '2026-08-31T10:00:00.000Z', updatedAt: '2026-08-31T10:01:00.000Z',
    };
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('This field is required.');

    mockLoadFormAttachments.mockResolvedValue([attachment]);
    mockPrepareFormSubmissionAttachments.mockImplementation(async (payload: any) => ({
      ...payload,
      responses: [...payload.responses, { fieldId: 'photo', value: '', fileIds: ['file-1'] }],
    }));
    await act(async () => { tree.unmount(); tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockSubmitForm).toHaveBeenCalledWith(expect.objectContaining({
      responses: expect.arrayContaining([{ fieldId: 'photo', value: '', fileIds: ['file-1'] }]),
    }));
    expect(mockMarkFormAttachmentsSubmitted).toHaveBeenCalledWith('biz-1:user-1:emp-1', 'form-submission:request-1');
  });

  it('rebinds a selected mandatory photo before upload preparation and submission', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in', context: { jobId: 'job-1' } };
    requiredForm.fields = requiredForm.fields.map((field: any) => field.id === 'photo'
      ? { ...field, type: 'photo_upload', required: true }
      : field);
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    const temporaryAttachment = {
      localAttachmentId: 'local-photo-1', identityKey: 'biz-1:user-1:emp-1', clientSubmissionId: 'form-submission:request-1',
      formId: 'form-1', fieldId: 'photo', localUri: 'file:///durable/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg',
      sizeBytes: 1024, state: 'local', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z',
    };
    const mandatoryAttachment = { ...temporaryAttachment, clientSubmissionId: 'form-submission:required-1' };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };
    mockLoadFormAttachments.mockResolvedValueOnce([temporaryAttachment]).mockResolvedValue([mandatoryAttachment]);
    mockRebindFormAttachments.mockResolvedValue([mandatoryAttachment]);
    mockPrepareFormSubmissionAttachments.mockImplementation(async (payload: any) => ({
      ...payload,
      responses: [...payload.responses.filter((response: any) => response.fieldId !== 'photo'), {
        fieldId: 'photo', value: '', fileIds: ['file-1'],
      }],
    }));
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmissionIdFor).toHaveBeenCalledWith('requirement-1');
    expect(mockRebindFormAttachments).toHaveBeenCalledWith(
      'biz-1:user-1:emp-1', 'form-submission:request-1', 'form-submission:required-1', 'token-1',
    );
    expect(mockPrepareFormSubmissionAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ clientSubmissionId: 'form-submission:required-1' }),
      'biz-1:user-1:emp-1',
      'token-1',
    );
    expect(mockSubmitForm).toHaveBeenCalledWith(expect.objectContaining({
      clientSubmissionId: 'form-submission:required-1',
      responses: expect.arrayContaining([{ fieldId: 'photo', value: '', fileIds: ['file-1'] }]),
    }));
  });

  it('keeps a selected photo retryable when mandatory attachment rebinding fails', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    const attachment = {
      localAttachmentId: 'local-photo-1', identityKey: 'biz-1:user-1:emp-1', clientSubmissionId: 'form-submission:request-1',
      formId: 'form-1', fieldId: 'photo', localUri: 'file:///durable/photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg',
      sizeBytes: 1024, state: 'local', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z',
    };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };
    mockLoadFormAttachments.mockResolvedValue([attachment]);
    mockRebindFormAttachments.mockRejectedValue(new Error('Could not update the saved photo. Try again.'));
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockSubmitForm).not.toHaveBeenCalled();
    expect(mockPrepareFormSubmissionAttachments).not.toHaveBeenCalled();
    expect(tree.root.findByType('status-banner').props.message).toBe('Could not update the saved photo. Try again.');
    expect(tree.root.findByType('primary-button').props.disabled).toBe(false);
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

  it('blocks Back while a mandatory clock-in form is outstanding', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    const requiredForm = { ...mockForm, trigger: 'before_clock_in' };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'clock-in-occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'clock-in-occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };
    await act(async () => { create(<FormScreen />); });

    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Clock in pending',
      'Complete this required form before clocking in.',
      expect.any(Array),
    );
  });

  it('preserves mandatory clock-out Back protection', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    const requiredForm = { ...mockForm, trigger: 'after_clock_out' };
    const requirement = { workflowRequirementId: 'requirement-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'clock-out-occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'clock-out-occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
    };
    await act(async () => { create(<FormScreen />); });

    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Clock out pending',
      'Complete this required form to finish clocking out.',
      expect.any(Array),
    );
  });

  it('allows Back from an unchanged ordinary form', async () => {
    let beforeRemove: any;
    mockAddListener.mockImplementation((_event: string, listener: unknown) => {
      beforeRemove = listener;
      return jest.fn();
    });
    await act(async () => { create(<FormScreen />); });

    const preventDefault = jest.fn();
    await act(async () => beforeRemove({ preventDefault, data: { action: { type: 'GO_BACK' } } }));

    expect(preventDefault).not.toHaveBeenCalled();
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

  it('keeps a mandatory form and workflow active after server accepted-response rejection', async () => {
    const requiredForm = { ...mockForm, trigger: 'after_clock_out' };
    const requirement = { workflowRequirementId: 'requirement-1', completed: false, form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'after_clock_out', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockOut = {
      ...mockPendingClockOut,
      workflow: { workflowOccurrenceId: 'occurrence-1', requirements: [requirement] },
      currentRequirement: requirement,
    };
    mockSubmitForm.mockResolvedValue({
      ok: false,
      code: 'form_response_requirement_failed',
      error: 'Contact your supervisor.',
      fieldErrors: { condition: 'Contact your supervisor.' },
    });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Still here'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(tree.root.findByProps({ testID: 'form-field-condition' }).props.value).toBe('Still here');
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Contact your supervisor.');
    expect(mockFinalize).not.toHaveBeenCalled();
    expect(mockRecoverPending).not.toHaveBeenCalled();
  });

  it('finalizes a mandatory form when the accepted submission is pending review', async () => {
    const requiredForm = { ...mockForm, trigger: 'before_clock_in', requiresApproval: true };
    const requirement = { requirementId: 'requirement-1', formId: 'form-1', form: requiredForm };
    mockParams = {
      formId: 'form-1', trigger: 'before_clock_in', workflowOccurrenceId: 'occurrence-1',
      workflowRequirementId: 'requirement-1',
    };
    mockPendingClockIn = {
      ...mockPendingClockIn,
      workflow: { workflowOccurrenceId: 'occurrence-1', remainingForms: [requirement] },
      currentRequirement: requirement,
    };
    mockSubmitForm.mockResolvedValue({ ok: true, submission: { id: 'sub-1', status: 'pending_review' } });
    let tree: any;
    await act(async () => { tree = create(<FormScreen />); });
    await act(async () => tree.root.findByProps({ testID: 'form-field-condition' }).props.onChangeText('Good'));
    await act(async () => tree.root.findByType('primary-button').props.onPress());

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/home');
    expect(mockPush).toHaveBeenCalledWith('/active-shift');
  });
});