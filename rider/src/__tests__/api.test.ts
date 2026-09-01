import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Trip Requests', () => {
    it('should create a trip request', async () => {
      const mockTrip = {
        id: 'trip-123',
        status: 'SEARCHING',
        suggestedFare: 15.50,
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { trip: mockTrip },
      });

      // Your API call here
      // const result = await createTrip(tripData);
      // expect(result.trip.id).toBe('trip-123');
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Invalid request' },
        },
      });

      // Your error handling test here
      // await expect(createTrip(invalidData)).rejects.toThrow();
    });
  });

  describe('Offer Acceptance', () => {
    it('should accept an offer', async () => {
      const mockResponse = {
        trip: {
          id: 'trip-123',
          status: 'ASSIGNED',
        },
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockResponse,
      });

      // Your accept offer test here
    });
  });
});
