import React from 'react';
import { act, create } from 'react-test-renderer';
import { StartTimeField, formatStartTime } from './StartTimeField';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    NativeModules: {},
    Platform: { OS: 'ios', select: (values: any) => values.ios ?? values.default },
    TurboModuleRegistry: { get: () => null },
    Modal: ({ children, visible }: any) => visible ? React.createElement('modal', {}, children) : null,
    Pressable: ({ children, onPress, testID, accessibilityLabel }: any) => React.createElement(
      'pressable',
      { onPress, testID, accessibilityLabel },
      typeof children === 'function' ? children({ pressed: false }) : children,
    ),
    StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
    Text: ({ children }: any) => React.createElement('text', {}, children),
    View: ({ children }: any) => React.createElement('view', {}, children),
  };
});

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: any) => require('react').createElement('date-time-picker', props),
}));

describe('StartTimeField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-02T12:12:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats Now and custom values compactly', () => {
    expect(formatStartTime(null)).toBe('Now');
    expect(formatStartTime('07:00')).toMatch(/7:00/);
  });

  it('supports Cancel, Done, and Reset to Now', async () => {
    const onChange = jest.fn();
    let tree: any;
    await act(async () => { tree = create(<StartTimeField value={null} businessTimeZone="America/Toronto" onChange={onChange} />); });

    await act(async () => tree.root.findByProps({ testID: 'clock-in-start-time' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'start-time-cancel' }).props.onPress());
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => tree.root.findByProps({ testID: 'clock-in-start-time' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'start-time-picker' }).props.onChange({}, new Date(2026, 8, 2, 7, 0)));
    await act(async () => tree.root.findByProps({ testID: 'start-time-done' }).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith('07:00');

    await act(async () => tree.update(<StartTimeField value="07:00" businessTimeZone="America/Toronto" onChange={onChange} />));
    await act(async () => tree.root.findByProps({ testID: 'clock-in-start-time' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'start-time-reset' }).props.onPress());
    expect(onChange).toHaveBeenLastCalledWith(null);
    await act(async () => tree.unmount());
  });

  it('opens Now at the current business wall time rather than device-local time', async () => {
    let tree: any;
    await act(async () => {
      tree = create(<StartTimeField value={null} businessTimeZone="America/Los_Angeles" onChange={jest.fn()} />);
    });

    await act(async () => tree.root.findByProps({ testID: 'clock-in-start-time' }).props.onPress());

    const picker = tree.root.findByProps({ testID: 'start-time-picker' });
    expect(picker.props.value.getHours()).toBe(5);
    expect(picker.props.value.getMinutes()).toBe(12);
    expect(picker.props.maximumDate.getHours()).toBe(5);
    await act(async () => tree.unmount());
  });
});