import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('date-picker', props),
}));

jest.mock('react-native', () => {
  const ReactModule = require('react');
  return {
    NativeModules: {},
    Platform: { select: (values: any) => values.ios ?? values.default },
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    TurboModuleRegistry: { get: () => null },
    View: ({ children, ...props }: any) => ReactModule.createElement('view', props, children),
    Text: ({ children, ...props }: any) => ReactModule.createElement('text', props, children),
    TextInput: (props: any) => ReactModule.createElement('textinput', props),
    Pressable: ({ children, onPress, ...props }: any) => ReactModule.createElement('pressable', { onPress, ...props }, children),
  };
});

import { FormFieldRenderer } from '@/components/FormFieldRenderer';
import type { EmployeeFormField } from '@/types/forms';

function field(id: string, type: EmployeeFormField['type'], extras: Partial<EmployeeFormField> = {}): EmployeeFormField {
  return { id, type, label: id, required: false, order: 1, ...extras };
}

describe('FormFieldRenderer', () => {
  it.each([
    ['short', 'single_line_text'],
    ['long', 'multi_line_text'],
    ['number', 'number'],
    ['currency', 'currency'],
    ['time', 'time'],
  ] as const)('renders %s as a controlled text input', async (id, type) => {
    let tree: any;
    await act(async () => {
      tree = create(<FormFieldRenderer field={field(id, type)} value="" onChange={jest.fn()} />);
    });
    expect(tree.root.findByProps({ testID: `form-field-${id}` })).toBeTruthy();
  });

  it('shows a friendly date and writes the selected local date canonically', async () => {
    const onChange = jest.fn();
    let tree: any;
    await act(async () => {
      tree = create(<FormFieldRenderer field={field('date', 'date', { required: true })} value="2026-08-19" onChange={onChange} />);
    });
    expect(tree.root.findByProps({ testID: 'form-field-date' }).props.accessibilityLabel).toContain('Aug 19, 2026');
    expect(tree.root.findAllByType('textinput')).toHaveLength(0);

    await act(async () => tree.root.findByProps({ testID: 'form-field-date' }).props.onPress());
    const picker = tree.root.findByType('date-picker');
    expect(picker.props.value.getFullYear()).toBe(2026);
    expect(picker.props.value.getMonth()).toBe(7);
    expect(picker.props.value.getDate()).toBe(19);
    await act(async () => picker.props.onChange({ type: 'set' }, new Date(2026, 7, 25, 12)));
    expect(onChange).toHaveBeenCalledWith('2026-08-25');
  });

  it.each([
    ['yesno', 'yes_no', undefined, undefined],
    ['checkbox', 'checkbox', ['Checked'], undefined],
    ['dropdown', 'dropdown', ['A'], undefined],
    ['multiple', 'multiple_choice', ['A'], undefined],
    ['employee', 'employee_selector', undefined, [{ value: 'emp-1', label: 'Alex' }]],
    ['job', 'job_selector', undefined, [{ value: 'job-1', label: 'Shoreline' }]],
    ['customer', 'customer_selector', undefined, [{ value: 'customer-1', label: 'Smith' }]],
  ] as const)('renders %s from exact backend options', async (id, type, options, choices) => {
    let tree: any;
    await act(async () => {
      tree = create(<FormFieldRenderer field={field(id, type, { options: options ? [...options] : undefined, choices: choices ? [...choices] : undefined })} value="" onChange={jest.fn()} />);
    });
    expect(tree.root.findAllByType('pressable').length).toBeGreaterThan(0);
  });

  it('renders display fields without controls and deferred fields with a clear message', async () => {
    const fields = [
      field('section', 'section_header'),
      field('paragraph', 'paragraph_text', { helpText: 'Read this first' }),
      field('signature', 'signature'),
      field('photo', 'photo_upload'),
      field('file', 'file_upload'),
    ];
    let tree: any;
    await act(async () => {
      tree = create(<>{fields.map((item) => <FormFieldRenderer key={item.id} field={item} value="" onChange={jest.fn()} />)}</>);
    });
    const text = tree.root.findAllByType('text').map((node: any) => String(node.props.children)).join(' ');
    expect(text).toContain('paragraph');
    expect(text).toContain('Read this first');
    expect(text.match(/newer mobile Forms version/g)).toHaveLength(3);
    expect(tree.root.findAllByType('textinput')).toHaveLength(0);
  });

  it('exposes field errors and selected option state accessibly', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<FormFieldRenderer field={field('damage', 'yes_no')} value="no" error="This field is required." onChange={jest.fn()} />);
    });
    expect(tree.root.findByProps({ testID: 'form-field-damage-option-no' }).props.accessibilityState.selected).toBe(true);
    expect(tree.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('This field is required.');
  });
});