import { api } from '@/services/api';
import {
  estimateDriverSwap,
  executeDriverSwap,
  SwapEstimate,
  SwapResult,
  WalletLedgerEntry,
} from '@/services/driver';

jest.mock('@/services/api');

describe('Driver Swap Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('estimates swap quote with proper parameters', async () => {
    const mockEstimate: SwapEstimate = {
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: '10.00',
      chainIn: 'Arc_Testnet',
      chainOut: 'Arc_Testnet',
      chain: 'Arc_Testnet',
      fromAddress: '0x1111111111111111111111111111111111111111',
      toAddress: '0x1111111111111111111111111111111111111111',
      stopLimit: { amount: '8.924000', token: 'EURC' },
      estimatedOutput: { amount: '9.200000', token: 'EURC' },
      exchangeRate: 0.92,
      fees: [
        { token: 'USDC', amount: '0.002000', type: 'provider' },
        { token: 'USDC', amount: '0.005000', type: 'gas' },
      ],
    };

    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { estimate: mockEstimate },
    });

    const result = await estimateDriverSwap({
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: 10,
    });

    expect(api.post).toHaveBeenCalledWith('/driver/wallet/swap/estimate', {
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: 10,
    });
    expect(result.tokenIn).toBe('USDC');
    expect(result.tokenOut).toBe('EURC');
    expect(result.estimatedOutput.amount).toBe('9.200000');
    expect(result.exchangeRate).toBe(0.92);
  });

  it('executes swap transaction and returns result with ledger entry', async () => {
    const mockResult: SwapResult = {
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      chainIn: 'Arc_Testnet',
      chainOut: 'Arc_Testnet',
      amountIn: '10.0',
      fromAddress: '0x1111111111111111111111111111111111111111',
      toAddress: '0x1111111111111111111111111111111111111111',
      txHash: '0x43cbe1234567890abcdef1234567890abcdef1234567890abcdef1234567890a',
      explorerUrl: 'https://testnet.arcscan.app/tx/0x43cbe1234567890abcdef1234567890abcdef1234567890abcdef1234567890a',
      fees: [{ token: 'USDC', amount: '0.002000', type: 'provider' }],
      progress: {
        status: 'DONE',
        substatus: 'COMPLETED',
        substatusMessage: 'The swap is complete on Arc Testnet.',
      },
      amountOut: '9.200000',
    };

    const mockEntry: WalletLedgerEntry = {
      id: 'ledger-swap-1',
      type: 'ADJUSTMENT',
      status: 'COMPLETED',
      method: 'WALLET',
      amount: 10,
      currency: 'USDC',
      brand: 'SWAP',
      providerRef: mockResult.txHash,
      note: 'Swapped 10.0 USDC for 9.200000 EURC',
      createdAt: new Date().toISOString(),
    };

    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { result: mockResult, entry: mockEntry },
    });

    const response = await executeDriverSwap({
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: 10,
    });

    expect(api.post).toHaveBeenCalledWith('/driver/wallet/swap', {
      tokenIn: 'USDC',
      tokenOut: 'EURC',
      amountIn: 10,
    });
    expect(response.result.txHash).toBe(mockResult.txHash);
    expect(response.result.amountOut).toBe('9.200000');
    expect(response.entry.brand).toBe('SWAP');
  });
});
