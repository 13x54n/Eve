import { isAuthRequest } from '@/services/api';

describe('isAuthRequest', () => {
  it('routes Auth0 and session paths to auth', () => {
    expect(isAuthRequest('/auth/auth0')).toBe(true);
    expect(isAuthRequest('auth/me')).toBe(true);
    expect(isAuthRequest('/auth/driver/auth0')).toBe(true);
  });

  it('routes driver login/register/auth0 to auth', () => {
    expect(isAuthRequest('/driver/login')).toBe(true);
    expect(isAuthRequest('/driver/register')).toBe(true);
    expect(isAuthRequest('/driver/auth0')).toBe(true);
  });

  it('keeps incoming trips and presence on the ride API base', () => {
    expect(isAuthRequest('/driver/trips/incoming')).toBe(false);
    expect(isAuthRequest('/driver/presence')).toBe(false);
  });
});
