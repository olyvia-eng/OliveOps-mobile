import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreate = jest.fn().mockResolvedValue({ ok: true, request: { id: 'request-1' } });
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
const mockSetDraft = jest.fn((draft: any) => { mockStore.draft = draft; });
const mockStore: any = {
  draft: { requestType: 'vacation', startDate: '', endDate: '', employeeNote: '' },
  setDraft: mockSetDraft,
  submissionAttempt: null,
};
let mockSubmitting = false;

jest.mock('expo-router', () => ({ router: {
  replace: (...args: unknown[]) => mockReplace(...args),
  dismissTo: (...args: unknown[]) => mockDismissTo(...args),
} }));
jest.mock('@/store/timeOffStore', () => ({ useTimeOffStore: () => mockStore }));
jest.mock('@/hooks/useTimeOffActions', () => ({
  useTimeOffActions: () => ({ create: mockCreate, submitting: mockSubmitting }),
}));
jest.mock('@/components/Screen', () => ({ Screen: ({ children }: any) => require('react').createElement('screen', {}, children) }));
jest.mock('@/components/MobilePrimitives', () => ({ ScreenHeader: ({ title }: any) => require('react').createElement('header', { title }) }));
jest.mock('@/components/StatusBanner', () => ({ StatusBanner: ({ message, tone }: any) => require('react').createElement('banner', { message, tone }) }));
jest.mock('@/components/PrimaryActionButton', () => ({ PrimaryActionButton: (props: any) => require('react').createElement('primary-button', props) }));
jest.mock('@/components/TimeOffDateField', () => ({ TimeOffDateField: (props: any) => require('react').createElement('date-field', props) }));
jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {}, Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
    TurboModuleRegistry: { get: () => null }, StyleSheet: { create: (value: unknown) => value },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    Pressable: ({ children, onPress, ...props }: any) => ReactModule.createElement('pressable', { onPress, ...props }, typeof children === 'function' ? children({ pressed: false }) : children),
    TextInput: (props: any) => ReactModule.createElement('text-input', props),
  };
});

import RequestTimeOffScreen from '../../app/request-time-off';

function textOf(tree: any) {
  return tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
}

describe('RequestTimeOffScreen', () => {
  beforeEach(() => {
    mockCreate.mockClear().mockResolvedValue({ ok: true, request: { id: 'request-1' } });
    mockReplace.mockClear();
    mockDismissTo.mockClear();
    mockSetDraft.mockClear();
    mockSubmitting = false;
    mockStore.submissionAttempt = null;
    mockStore.draft = { requestType: 'vacation', startDate: '', endDate: '', employeeNote: '' };
  });

  it('renders all exact request type choices and exposes both date pickers', async () => {
    let tree: any;
    await act(async () => { tree = create(<RequestTimeOffScreen />); });
    expect(textOf(tree)).toContain('Vacation');
    expect(textOf(tree)).toContain('Sick');
    expect(textOf(tree)).toContain('Personal');
    expect(textOf(tree)).toContain('Unpaid');
    expect(textOf(tree)).toContain('Other');
    expect(tree.root.findByProps({ testID: 'time-off-start-date' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'time-off-end-date' })).toBeTruthy();
  });

  it('rejects reversed dates and accepts exact canonical single-day dates', async () => {
    mockStore.draft = { requestType: 'sick', startDate: '2026-08-30', endDate: '2026-08-28', employeeNote: 'Unwell' };
    let tree: any;
    await act(async () => { tree = create(<RequestTimeOffScreen />); });
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'time-off-end-date' }).props.error).toBe('End date cannot be before start date.');

    await act(async () => tree.root.findByProps({ testID: 'time-off-end-date' }).props.onChange('2026-08-30'));
    await act(async () => tree.update(<RequestTimeOffScreen />));
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(mockCreate).toHaveBeenCalledWith({
      requestType: 'sick', startDate: '2026-08-30', endDate: '2026-08-30', employeeNote: 'Unwell',
    });
    expect(mockDismissTo).toHaveBeenCalledWith('/time-off');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('preserves values and shows errors when submission is not confirmed', async () => {
    mockStore.draft = { requestType: 'personal', startDate: '2026-09-01', endDate: '2026-09-02', employeeNote: 'Appointment' };
    mockCreate.mockResolvedValue({ ok: false, uncertain: true, error: 'Submission could not be confirmed.' });
    let tree: any;
    await act(async () => { tree = create(<RequestTimeOffScreen />); });
    await act(async () => tree.root.findByType('primary-button').props.onPress());
    expect(tree.root.findByType('banner').props.message).toBe('Submission could not be confirmed.');
    expect(mockStore.draft.employeeNote).toBe('Appointment');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
