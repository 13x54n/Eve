process.env.EXPO_PUBLIC_AUTH_URL = 'http://localhost:4001/api';
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4003/api';
process.env.EXPO_PUBLIC_WS_URL = 'http://localhost:4004';
process.env.EXPO_PUBLIC_AUTH0_DOMAIN = 'dev-example.us.auth0.com';
process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'test-client-id';

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

jest.mock('react-native-auth0', () => ({
  WebAuthError: class WebAuthError extends Error {
    constructor(type) {
      super(type);
      this.type = type;
    }
  },
  WebAuthErrorCodes: { USER_CANCELLED: 'USER_CANCELLED' },
  useAuth0: jest.fn(() => ({
    authorize: jest.fn(),
    clearSession: jest.fn(),
    getCredentials: jest.fn(),
    user: null,
    error: null,
    isLoading: false,
  })),
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
