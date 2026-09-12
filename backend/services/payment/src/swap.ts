import { fail } from "@eve/shared";
import {
  ARC_EURC_ERC20_ADDRESS,
  ARC_USDC_ERC20_ADDRESS,
} from "@eve/shared/treasury";

export type SupportedToken = "USDC" | "EURC" | "cirBTC";

export const SUPPORTED_SWAP_TOKENS: readonly SupportedToken[] = [
  "USDC",
  "EURC",
  "cirBTC",
] as const;

export type SwapEstimateFee = {
  token: string;
  amount: string;
  type: "provider" | "gas";
};

export type SwapEstimate = {
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amountIn: string;
  chainIn: string;
  chainOut: string;
  chain: string;
  fromAddress: string;
  toAddress: string;
  stopLimit: {
    amount: string;
    token: SupportedToken;
  };
  estimatedOutput: {
    amount: string;
    token: SupportedToken;
  };
  exchangeRate: number;
  fees: SwapEstimateFee[];
};

export type SwapResult = {
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  chainIn: string;
  chainOut: string;
  amountIn: string;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  explorerUrl: string;
  fees: { token: string; amount: string; type: string }[];
  progress: {
    status: "DONE" | "PENDING" | "FAILED";
    substatus: string;
    substatusMessage: string;
  };
  amountOut: string;
};

export type EstimateInput = {
  tokenIn: string;
  tokenOut: string;
  amountIn: number | string;
  sourceWalletAddress: string;
};

export type ExecuteInput = {
  tokenIn: string;
  tokenOut: string;
  amountIn: number | string;
  sourceWalletAddress: string;
  depositTxHash?: string;
};

// Base exchange rates on Arc Testnet
const RATES_TO_USD: Record<SupportedToken, number> = {
  USDC: 1.0,
  EURC: 1.087, // 1 EURC ≈ 1.087 USD; 1 USDC ≈ 0.92 EURC
  cirBTC: 65000.0,
};

function getRate(from: SupportedToken, to: SupportedToken): number {
  const fromUsd = RATES_TO_USD[from];
  const toUsd = RATES_TO_USD[to];
  return fromUsd / toUsd;
}

function parseToken(raw: string, paramName: string): SupportedToken {
  const normalized = raw.trim().toUpperCase();
  if (!SUPPORTED_SWAP_TOKENS.includes(normalized as SupportedToken)) {
    fail(
      `Unsupported ${paramName} '${raw}'. Supported tokens on Arc Testnet are: ${SUPPORTED_SWAP_TOKENS.join(", ")}`,
      "ValidationError",
    );
  }
  return normalized as SupportedToken;
}

function parseAmount(raw: number | string): number {
  const num = typeof raw === "string" ? Number.parseFloat(raw.trim()) : Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    fail("Swap amount must be a positive number", "ValidationError");
  }
  return num;
}

/**
 * Calculates deterministic swap quotation adhering to Circle App Kit Swap schema.
 */
export function calculateSwapEstimate(input: EstimateInput): SwapEstimate {
  const tokenIn = parseToken(input.tokenIn, "tokenIn");
  const tokenOut = parseToken(input.tokenOut, "tokenOut");

  if (tokenIn === tokenOut) {
    fail("tokenIn and tokenOut must be different", "ValidationError");
  }

  const amountInNum = parseAmount(input.amountIn);
  const rate = getRate(tokenIn, tokenOut);

  // Provider fee: 0.02% (or min 0.0002 in input currency)
  const providerFeeAmount = Math.max(amountInNum * 0.0002, 0.0002);
  const gasFeeAmount = 0.005; // Arc Testnet USDC gas fee

  const netInput = Math.max(0, amountInNum - providerFeeAmount);
  const rawOutput = netInput * rate;

  // Decimal formatting based on token type (BTC: 8 decimals, USDC/EURC: 6 decimals)
  const decimals = tokenOut === "cirBTC" ? 8 : 6;
  const estimatedOutputStr = rawOutput.toFixed(decimals);

  // 3% slippage tolerance for stopLimit
  const stopLimitNum = rawOutput * 0.97;
  const stopLimitStr = stopLimitNum.toFixed(decimals);

  const address = input.sourceWalletAddress.trim();

  return {
    tokenIn,
    tokenOut,
    amountIn: amountInNum.toString(),
    chainIn: "Arc_Testnet",
    chainOut: "Arc_Testnet",
    chain: "Arc_Testnet",
    fromAddress: address,
    toAddress: address,
    stopLimit: {
      amount: stopLimitStr,
      token: tokenOut,
    },
    estimatedOutput: {
      amount: estimatedOutputStr,
      token: tokenOut,
    },
    exchangeRate: Number(rate.toFixed(6)),
    fees: [
      { token: tokenIn, amount: providerFeeAmount.toFixed(tokenIn === "cirBTC" ? 8 : 6), type: "provider" },
      { token: "USDC", amount: gasFeeAmount.toFixed(6), type: "gas" },
    ],
  };
}

export async function executeTokenSwap(input: ExecuteInput): Promise<SwapResult> {
  const estimate = calculateSwapEstimate(input);

  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET?.trim();

  if (apiKey && entitySecret) {
    try {
      const appKitModule = await import("@circle-fin/app-kit" as string).catch(() => null);
      const circleAdapterModule = await import("@circle-fin/adapter-circle-wallets" as string).catch(() => null);

      if (appKitModule?.AppKit && circleAdapterModule?.createCircleWalletsAdapter) {
        const kit = new appKitModule.AppKit();
        const adapter = circleAdapterModule.createCircleWalletsAdapter({
          apiKey,
          entitySecret,
        });

        const swapParams = {
          from: {
            adapter,
            chain: "Arc_Testnet",
            address: estimate.fromAddress,
          },
          tokenIn: estimate.tokenIn,
          tokenOut: estimate.tokenOut,
          amountIn: estimate.amountIn,
          config: { apiKey },
        };

        const sdkResult = await kit.swap(swapParams);
        if (sdkResult && sdkResult.txHash) {
          return {
            tokenIn: estimate.tokenIn,
            tokenOut: estimate.tokenOut,
            chainIn: "Arc_Testnet",
            chainOut: "Arc_Testnet",
            amountIn: estimate.amountIn,
            fromAddress: estimate.fromAddress,
            toAddress: estimate.toAddress,
            txHash: sdkResult.txHash,
            explorerUrl: sdkResult.explorerUrl || `https://testnet.arcscan.app/tx/${sdkResult.txHash}`,
            fees: sdkResult.fees || estimate.fees,
            progress: sdkResult.progress || {
              status: "DONE",
              substatus: "COMPLETED",
              substatusMessage: "The swap is complete.",
            },
            amountOut: sdkResult.amountOut || estimate.estimatedOutput.amount,
          };
        }
      }
    } catch (error) {
      console.warn("[swap] Live AppKit execution failed, using treasury settlement:", error);
    }
  }

  const { fail } = await import("@eve/shared");
  const {
    ARC_EURC_ERC20_ADDRESS,
    ARC_EURC_ERC20_DECIMALS,
    ARC_USDC_ERC20_ADDRESS,
    ARC_USDC_ERC20_DECIMALS,
    isTreasuryConfigured,
    sendTreasuryErc20,
    treasuryAccount,
  } = await import("@eve/shared/treasury");
  const { waitForErc20Transfer } = await import("./chain.js");

  if (!isTreasuryConfigured()) {
    fail("Treasury is not configured; cannot settle swap on-chain", "ConflictError");
  }
  const treasury = treasuryAccount()?.address;
  if (!treasury) {
    fail("Treasury is not configured; cannot settle swap on-chain", "ConflictError");
  }
  const treasuryAddress = treasury as string;
  const depositTxHash = input.depositTxHash?.trim();
  if (!depositTxHash) {
    fail("Swap execute requires an on-chain deposit of tokenIn to the treasury", "ValidationError");
  }
  const confirmedDeposit = depositTxHash as string;

  const tokenInAddress =
    estimate.tokenIn === "EURC" ? ARC_EURC_ERC20_ADDRESS : ARC_USDC_ERC20_ADDRESS;
  const tokenOutAddress =
    estimate.tokenOut === "EURC" ? ARC_EURC_ERC20_ADDRESS : ARC_USDC_ERC20_ADDRESS;
  const tokenInDecimals = estimate.tokenIn === "EURC" ? ARC_EURC_ERC20_DECIMALS : ARC_USDC_ERC20_DECIMALS;
  const tokenOutDecimals = estimate.tokenOut === "EURC" ? ARC_EURC_ERC20_DECIMALS : ARC_USDC_ERC20_DECIMALS;

  const { getEurcBalance, getUsdcBalance } = await import("./chain.js");
  const neededOut = Number(estimate.estimatedOutput.amount);
  const readTreasuryOut = () =>
    estimate.tokenOut === "EURC"
      ? getEurcBalance(treasuryAddress)
      : getUsdcBalance(treasuryAddress);

  async function refundDeposit(treasuryOut: number, reason: string): Promise<never> {
    try {
      await sendTreasuryErc20(
        estimate.fromAddress,
        tokenInAddress,
        Number(estimate.amountIn),
        tokenInDecimals,
      );
    } catch (refundError) {
      console.error("[swap] Failed to refund tokenIn after payout failure:", refundError);
    }
    fail(
      `Treasury has ${treasuryOut.toFixed(6)} ${estimate.tokenOut} but this swap needs ${neededOut} ${estimate.tokenOut}. ${reason} Fund the treasury, then retry.`,
      "ConflictError",
    );
  }

  async function confirmDeposit() {
    try {
      await waitForErc20Transfer({
        txHash: confirmedDeposit,
        token: tokenInAddress,
        from: estimate.fromAddress,
        to: treasuryAddress,
        minAmount: Number(estimate.amountIn),
        decimals: tokenInDecimals,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deposit was not confirmed on-chain";
      fail(message, "ValidationError");
    }
  }

  // Liquidity first: do not wait on a doomed payout. If the driver already sent tokenIn, refund it.
  const treasuryOutBefore = await readTreasuryOut();
  if (treasuryOutBefore + 1e-9 < neededOut) {
    await confirmDeposit();
    await refundDeposit(treasuryOutBefore, "Output token balance is too low.");
  }

  await confirmDeposit();

  let payout;
  try {
    payout = await sendTreasuryErc20(
      estimate.toAddress,
      tokenOutAddress,
      neededOut,
      tokenOutDecimals,
    );
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const treasuryOutNow = await readTreasuryOut();
    if (raw.includes("exceeds balance") || raw.includes("transfer amount exceeds")) {
      await refundDeposit(treasuryOutNow, "On-chain payout reverted (insufficient treasury balance).");
    }
    fail(
      raw.includes("exceeds balance")
        ? `Treasury cannot pay ${neededOut} ${estimate.tokenOut} right now. Fund the treasury and retry.`
        : `Swap payout failed: ${raw}`,
      "ConflictError",
    );
  }

  return {
    tokenIn: estimate.tokenIn,
    tokenOut: estimate.tokenOut,
    chainIn: "Arc_Testnet",
    chainOut: "Arc_Testnet",
    amountIn: estimate.amountIn,
    fromAddress: estimate.fromAddress,
    toAddress: estimate.toAddress,
    txHash: payout.txHash,
    explorerUrl: `https://testnet.arcscan.app/tx/${payout.txHash}`,
    fees: [{ token: estimate.tokenIn, amount: estimate.fees[0].amount, type: "provider" }],
    progress: {
      status: "DONE",
      substatus: "COMPLETED",
      substatusMessage: "The swap is complete on Arc Testnet.",
    },
    amountOut: estimate.estimatedOutput.amount,
  };
}
