import {
  getBankAccounts,
  registerBankAccount,
  deleteBankAccount,
  createFiatPayout,
  getPayoutStatus,
  RegisterBankAccountInput,
} from '@/services/driver';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('Driver Bank Accounts & Fiat Payouts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBankAccounts', () => {
    it('calls GET /driver/wallet/bank-accounts and returns account list', async () => {
      const mockAccounts = [
        {
          id: 'acc_123',
          currency: 'usd',
          bank_name: 'Chase',
          account_type: 'us',
          last_4: '4321',
          account_owner_name: 'Jane Doe',
          created_at: '2026-09-08T00:00:00Z',
        },
      ];

      mockedApi.get.mockResolvedValueOnce({
        data: { accounts: mockAccounts },
      } as never);

      const result = await getBankAccounts();

      expect(mockedApi.get).toHaveBeenCalledWith('/driver/wallet/bank-accounts');
      expect(result).toEqual(mockAccounts);
    });

    it('returns empty array if accounts is null or undefined', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: {},
      } as never);

      const result = await getBankAccounts();
      expect(result).toEqual([]);
    });
  });

  describe('registerBankAccount', () => {
    it('calls POST /driver/wallet/bank-accounts with proper input', async () => {
      const input: RegisterBankAccountInput = {
        accountOwnerName: 'Jane Doe',
        bankName: 'Chase',
        routingNumber: '021000021',
        accountNumber: '1234567890',
        checkingOrSavings: 'checking',
        address: {
          streetLine1: '100 Market St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
        },
      };

      const mockResponse = {
        id: 'acc_new_1',
        currency: 'usd',
        bank_name: 'Chase',
        account_type: 'us',
        last_4: '7890',
        account_owner_name: 'Jane Doe',
        created_at: '2026-09-08T00:00:00Z',
      };

      mockedApi.post.mockResolvedValueOnce({
        data: { external_fiat_account: mockResponse },
      } as never);

      const result = await registerBankAccount(input);

      expect(mockedApi.post).toHaveBeenCalledWith('/driver/wallet/bank-accounts', input);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteBankAccount', () => {
    it('calls DELETE /driver/wallet/bank-accounts/:id', async () => {
      mockedApi.delete.mockResolvedValueOnce({
        data: { success: true },
      } as never);

      const result = await deleteBankAccount('acc_123');

      expect(mockedApi.delete).toHaveBeenCalledWith('/driver/wallet/bank-accounts/acc_123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('createFiatPayout', () => {
    it('calls POST /driver/wallet/payout with payload', async () => {
      const payload = {
        amount: 50.0,
        fiatAccountId: 'acc_123',
        idempotencyKey: 'idem-test-99',
      };

      const mockPayoutRes = {
        payout: {
          id: 'action_payout_123',
          type: 'payout',
          status: 'pending',
          amount: '50.00',
          currency: 'usd',
          created_at: '2026-09-08T00:00:00Z',
        },
        entry: {
          id: 'ledger_123',
          amount: -50.0,
          category: 'PAYOUT',
          status: 'PENDING',
        },
        replayed: false,
      };

      mockedApi.post.mockResolvedValueOnce({
        data: mockPayoutRes,
      } as never);

      const result = await createFiatPayout(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/driver/wallet/payout', payload);
      expect(result).toEqual(mockPayoutRes);
    });
  });

  describe('getPayoutStatus', () => {
    it('calls GET /driver/wallet/payout/:actionId', async () => {
      const mockStatusRes = {
        payout: {
          id: 'action_payout_123',
          type: 'payout',
          status: 'succeeded',
          amount: '50.00',
          currency: 'usd',
          created_at: '2026-09-08T00:00:00Z',
        },
        entry: {
          id: 'ledger_123',
          amount: -50.0,
          category: 'PAYOUT',
          status: 'COMPLETED',
        },
      };

      mockedApi.get.mockResolvedValueOnce({
        data: mockStatusRes,
      } as never);

      const result = await getPayoutStatus('action_payout_123');

      expect(mockedApi.get).toHaveBeenCalledWith('/driver/wallet/payout/action_payout_123');
      expect(result).toEqual(mockStatusRes);
    });
  });
});

