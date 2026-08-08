import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogin = jest.fn();
const mockIsOnline = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ login: mockLogin, warning: undefined }),
}));

jest.mock('@/services/connectivity', () => ({
  isOnline: () => mockIsOnline(),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => require('react').createElement('offline-notice'),
}));

jest.mock('react-native', () => {
  const ReactModule = require('react');
  const container = (name: string) => ({ children, ...props }: any) =>
    ReactModule.createElement(name, props, children);
  return {
    ActivityIndicator: container('activity-indicator'),
    Image: container('image'),
    Keyboard: { dismiss: jest.fn() },
    KeyboardAvoidingView: container('keyboard-avoiding-view'),
    Platform: { select: (values: any) => values.ios },
    Pressable: ({ children, ...props }: any) => ReactModule.createElement(
      'pressable',
      props,
      typeof children === 'function' ? children({ pressed: false }) : children
    ),
    SafeAreaView: container('safe-area-view'),
    ScrollView: container('scroll-view'),
    StyleSheet: { create: (value: unknown) => value },
    Text: container('text'),
    TextInput: container('text-input'),
    TouchableWithoutFeedback: container('touchable-without-feedback'),
    View: container('view'),
  };
});

import LoginScreen from '../../app/login';

describe('LoginScreen', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockIsOnline.mockReset();
  });

  it('shows offline state and does not submit credentials without connectivity', async () => {
    mockIsOnline.mockResolvedValue(false);

    let tree: any;
    await act(async () => {
      tree = create(React.createElement(LoginScreen));
    });

    const inputs = tree.root.findAllByType('text-input');
    await act(async () => {
      inputs.find((node: any) => node.props.placeholder === 'you@company.com').props.onChangeText('crew@oliveops.ca');
      inputs.find((node: any) => node.props.placeholder === 'Enter your password').props.onChangeText('not-logged');
    });

    const submit = tree.root.findAllByType('pressable').find((node: any) =>
      node.findAllByType('text').some((text: any) => String(text.props.children).includes('Sign In'))
    );
    await act(async () => {
      submit.props.onPress();
    });

    expect(tree.root.findAllByType('offline-notice')).toHaveLength(1);
    expect(mockLogin).not.toHaveBeenCalled();
    const renderedText = tree.root.findAllByType('text')
      .map((node: any) => String(node.props.children))
      .join(' ');
    expect(renderedText).toContain('Offline. Reconnect and try signing in again.');
  });
});