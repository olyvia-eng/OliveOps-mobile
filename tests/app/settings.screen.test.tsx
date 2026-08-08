import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogout = jest.fn().mockResolvedValue(undefined);

const mockUseAuthStore = jest.fn(() => ({
  user: {
    id: 'u-1',
    businessId: 'biz-1',
    name: 'Alex',
    email: 'a@x.com',
    role: 'crew_member',
    businessName: 'OliveOps',
    employeeId: 'emp-1',
  },
  logout: mockLogout,
}));

const mockOpenUrl = jest.fn().mockResolvedValue(true);

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/components/Screen', () => ({
  Screen: ({ children }: any) => require('react').createElement('screen', {}, children),
}));

jest.mock('@/components/PrimaryActionButton', () => ({
  PrimaryActionButton: ({ label, onPress }: any) =>
    require('react').createElement('primary-button', { label, onPress }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: (value: unknown) => value },
    Linking: { openURL: (...args: any[]) => mockOpenUrl(...args) },
    View: ({ children }: any) => React.createElement('view', {}, children),
    Text: ({ children }: any) => React.createElement('text', {}, children),
    Pressable: ({ children, onPress }: any) => React.createElement('pressable', { onPress }, children),
  };
});

import { router } from 'expo-router';
import SettingsScreen from '../../app/settings';

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    mockOpenUrl.mockClear();
    (router.replace as jest.Mock).mockClear();
  });

  it('opens privacy, terms, and support links', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SettingsScreen));
    });

    const pressables = tree.root.findAllByType('pressable');

    await act(async () => {
      pressables[0].props.onPress();
      pressables[1].props.onPress();
      pressables[2].props.onPress();
    });

    expect(mockOpenUrl).toHaveBeenNthCalledWith(1, 'https://www.oliveops.ca/privacy');
    expect(mockOpenUrl).toHaveBeenNthCalledWith(2, 'https://www.oliveops.ca/terms');
    expect(mockOpenUrl).toHaveBeenNthCalledWith(3, 'mailto:support@oliveops.ca');
  });

  it('logs out and routes to login', async () => {
    let tree: any;
    await act(async () => {
      tree = create(React.createElement(SettingsScreen));
    });

    const logoutButton = tree.root.findAllByType('primary-button').find((node: any) => node.props.label === 'Log Out');

    await act(async () => {
      await logoutButton.props.onPress();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});
