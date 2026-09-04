import * as SecureStore from 'expo-secure-store';
import { ACCESS_TOKEN_KEY, exchangePrivy } from '@/services/auth';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('exchangePrivy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts the identity token to /auth/privy and stores the access token', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        accessToken: 'eve-jwt',
        user: { id: 'u1', role: 'RIDER', name: 'Ada', email: 'ada@example.com' },
      },
    } as never);

    const result = await exchangePrivy({ identityToken: 'id-token' });

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/privy', { identityToken: 'id-token' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      ACCESS_TOKEN_KEY,
      'eve-jwt',
      expect.objectContaining({
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    );
    expect(result.accessToken).toBe('eve-jwt');
  });
});
