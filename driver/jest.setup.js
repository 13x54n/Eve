process.env.EXPO_PUBLIC_AUTH_URL = 'http://localhost:4001/api';
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4003/api';
process.env.EXPO_PUBLIC_WS_URL = 'http://localhost:4004';
process.env.EXPO_PUBLIC_PRIVY_APP_ID = 'test-privy-app-id';
process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID = 'test-client-id';

import '@testing-library/jest-native/extend-expect';

// Mock expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: 'Link',
  Stack: 'Stack',
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
      },
    })
  ),
  watchPositionAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({ data: 'ExponentPushToken[mock]' })
  ),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

jest.mock('@privy-io/expo', () => ({
  usePrivy: jest.fn(() => ({
    user: null,
    isReady: true,
    error: null,
    logout: jest.fn(),
    getAccessToken: jest.fn(),
    refreshUser: jest.fn(),
  })),
  useLoginWithSMS: jest.fn(() => ({
    sendCode: jest.fn(),
    loginWithCode: jest.fn(),
    state: { status: 'initial' },
  })),
  useLoginWithEmail: jest.fn(() => ({
    sendCode: jest.fn(),
    loginWithCode: jest.fn(),
    state: { status: 'initial' },
  })),
  useIdentityToken: jest.fn(() => ({
    getIdentityToken: jest.fn(),
  })),
  useEmbeddedEthereumWallet: jest.fn(() => ({
    wallets: [],
    create: jest.fn(),
  })),
  useEmbeddedSolanaWallet: jest.fn(() => ({
    wallets: [],
    create: jest.fn(),
  })),
  PrivyProvider: ({ children }) => children,
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() =>
    Promise.resolve({
      type: 'success',
      uri: 'file://mock-document.pdf',
      name: 'document.pdf',
    })
  ),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const Animated = {
    View,
    createAnimatedComponent: (Component) => Component,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
  };
});

jest.mock('react-native-worklets', () => ({}));

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

global.fetch = jest.fn();
