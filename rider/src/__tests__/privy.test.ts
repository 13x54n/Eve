import {
  formatPhoneForPrivy,
  requirePrivyConfig,
  requireRelyingParty,
  truncateWalletAddress,
} from '@/lib/privy';

describe('requirePrivyConfig', () => {
  const originalAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const originalClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

  afterEach(() => {
    process.env.EXPO_PUBLIC_PRIVY_APP_ID = originalAppId;
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID = originalClientId;
  });

  it('throws when app id or client id is missing', () => {
    delete process.env.EXPO_PUBLIC_PRIVY_APP_ID;
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID = 'client';
    expect(() => requirePrivyConfig()).toThrow(
      'EXPO_PUBLIC_PRIVY_APP_ID and EXPO_PUBLIC_PRIVY_CLIENT_ID are not set',
    );
  });

  it('returns appId and clientId', () => {
    process.env.EXPO_PUBLIC_PRIVY_APP_ID = 'app_123';
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID = 'client_123';
    expect(requirePrivyConfig()).toEqual({
      appId: 'app_123',
      clientId: 'client_123',
    });
  });
});

describe('privy helpers', () => {
  it('strips trailing slashes from the relying party', () => {
    process.env.EXPO_PUBLIC_PRIVY_RELYING_PARTY = 'https://example.com/';
    expect(requireRelyingParty()).toBe('https://example.com');
  });

  it('formats US phone numbers with +1', () => {
    expect(formatPhoneForPrivy('5551234567')).toBe('+15551234567');
    expect(formatPhoneForPrivy('+44 7700 900123')).toBe('+447700900123');
  });

  it('truncates wallet addresses', () => {
    expect(truncateWalletAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(
      '0x1234…5678',
    );
  });
});
