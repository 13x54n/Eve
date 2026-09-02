import { Platform } from 'react-native';
import { auth0LogoutReturnTo, requireAuth0Config } from '@/lib/auth0';

describe('requireAuth0Config', () => {
  const originalDomain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
  const originalClientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_AUTH0_DOMAIN = originalDomain;
    process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = originalClientId;
  });

  it('throws when domain or client id is missing', () => {
    delete process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
    process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'client';
    expect(() => requireAuth0Config()).toThrow(
      'EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID are not set',
    );
  });

  it('strips https:// and trailing slashes from the domain', () => {
    process.env.EXPO_PUBLIC_AUTH0_DOMAIN = 'https://Dev-Example.us.auth0.com/';
    process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'client';
    expect(requireAuth0Config()).toEqual({
      domain: 'dev-example.us.auth0.com',
      clientId: 'client',
    });
  });
});

describe('auth0LogoutReturnTo', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_AUTH0_DOMAIN = 'https://dev-example.us.auth0.com';
    process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID = 'client';
  });

  it('builds an ios logout URL with scheme, host, bundle, and /logout', () => {
    Platform.OS = 'ios';
    expect(auth0LogoutReturnTo()).toBe(
      'evedriver://dev-example.us.auth0.com/ios/ca.sherpafoods.evedriver/logout',
    );
  });

  it('builds an android logout URL', () => {
    Platform.OS = 'android';
    expect(auth0LogoutReturnTo()).toBe(
      'evedriver://dev-example.us.auth0.com/android/ca.sherpafoods.evedriver/logout',
    );
  });
});
