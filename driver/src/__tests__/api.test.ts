import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Driver API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Going Online/Offline', () => {
    it('should toggle driver status to online', async () => {
      const mockResponse = {
        driver: {
          id: 'driver-123',
          presence: 'ONLINE',
        },
      };

      mockedAxios.patch.mockResolvedValueOnce({
        data: mockResponse,
      });

      // Your toggle online test here
    });
  });

  describe('Sending Offers', () => {
    it('should send offer to rider', async () => {
      const mockOffer = {
        id: 'offer-123',
        proposedFare: 20.00,
        etaMinutes: 5,
        status: 'PENDING',
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { offer: mockOffer },
      });

      // Your send offer test here
    });
  });

  describe('Earnings', () => {
    it('should fetch earnings summary', async () => {
      const mockEarnings = {
        todayEarnings: 150.00,
        weekEarnings: 750.00,
        totalEarnings: 5000.00,
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockEarnings,
      });

      // Your fetch earnings test here
    });
  });
});
