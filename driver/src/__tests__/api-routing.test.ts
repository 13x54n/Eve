import { isAuthRequest, isPaymentRequest } from '@/services/api';

describe('isAuthRequest', () => {
  it('routes Privy and session paths to auth', () => {
    expect(isAuthRequest('/auth/privy')).toBe(true);
    expect(isAuthRequest('auth/me')).toBe(true);
    expect(isAuthRequest('/auth/driver/privy')).toBe(true);
  });

  it('routes driver login/register/privy to auth', () => {
    expect(isAuthRequest('/driver/login')).toBe(true);
    expect(isAuthRequest('/driver/register')).toBe(true);
    expect(isAuthRequest('/driver/privy')).toBe(true);
  });

  it('keeps incoming trips and presence on the ride API base', () => {
    expect(isAuthRequest('/driver/trips/incoming')).toBe(false);
    expect(isAuthRequest('/driver/presence')).toBe(false);
  });
});

describe('isPaymentRequest', () => {
  it('routes driver wallet endpoints and swap to payment service', () => {
    expect(isPaymentRequest('/driver/wallet')).toBe(true);
    expect(isPaymentRequest('/driver/wallet/withdraw')).toBe(true);
    expect(isPaymentRequest('/driver/wallet/swap/estimate')).toBe(true);
    expect(isPaymentRequest('/driver/wallet/swap')).toBe(true);
  });
});
