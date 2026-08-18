import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

const mockGetSubmission = jest.fn();
const detail = {
  ok: true,
  submission: {
    submissionId: 'sub-1', formId: 'form-1', formName: 'Daily Equipment Inspection',
    submittedAt: '2026-08-18T11:04:00.000Z', status: 'submitted', trigger: 'daily',
    context: { equipmentId: 'eq-1', equipmentName: 'Bobcat E50' },
  },
  form: { id: 'form-1', name: 'Daily Equipment Inspection', description: 'Inspect before use' },
  answers: [
    { fieldId: 'oil', label: 'Oil Level', type: 'multiple_choice', value: 'Good' },
    { fieldId: 'damage', label: 'Visible Damage', type: 'yes_no', value: 'no' },
  ],
};

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'sub-1' }) }));
jest.mock('@/store/formsStore', () => ({ useFormsStore: () => ({ submissionDetails: { 'sub-1': detail } }) }));
jest.mock('@/hooks/useFormsActions', () => ({ useFormsActions: () => ({ getSubmission: mockGetSubmission, loadingSubmission: false }) }));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 }, TurboModuleRegistry: { get: () => null },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, ...props }: any) => ReactModule.createElement('pressable', props, children),
  };
});

import FormSubmissionScreen from '../../app/form-submission';

describe('FormSubmissionScreen', () => {
  it('renders employee-safe answers and context without edit or review controls', async () => {
    let tree: any;
    await act(async () => { tree = create(<FormSubmissionScreen />); });
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('Daily Equipment Inspection');
    expect(text).toContain('Bobcat E50');
    expect(text).toContain('Oil Level');
    expect(text).toContain('Good');
    expect(text).toContain('Visible Damage');
    expect(text).toContain('no');
    expect(text).not.toContain('Approve');
    expect(text).not.toContain('Reject');
    expect(tree.root.findAllByType('textinput')).toHaveLength(0);
    expect(mockGetSubmission).not.toHaveBeenCalled();
  });
});