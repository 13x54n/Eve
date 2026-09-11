import { getIncomingTrips, updatePresence } from '@/services/driver';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    patch: jest.fn(),
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('driver presence and incoming trips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PATCHes /driver/presence', async () => {
    mockedApi.patch.mockResolvedValueOnce({
      data: { driver: { id: 'd1', presence: 'ONLINE' } },
    } as never);

    await updatePresence({
      presence: 'ONLINE',
      latitude: 43.65,
      longitude: -79.38,
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/driver/presence', {
      presence: 'ONLINE',
      latitude: 43.65,
      longitude: -79.38,
    });
  });

  it('GETs /driver/trips/incoming', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { trips: [], pendingOffer: null, activeDispatch: null },
    } as never);

    await getIncomingTrips();

    expect(mockedApi.get).toHaveBeenCalledWith('/driver/trips/incoming');
  });
});
