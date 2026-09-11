import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@eve/http";
import * as paymentService from "./payment.service.js";
import * as privyFiatService from "./privy-fiat.js";
import * as swapService from "./swap.service.js";

function userId(req: Request) {
  return (req as AuthenticatedRequest).user.id;
}

const confirmSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  action: z
    .enum(["deposit", "startSettlement", "dispute", "finalize", "refund"])
    .optional(),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

const transferSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
  address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function config(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(paymentService.publicPaymentConfig());
  } catch (error) {
    next(error);
  }
}

export async function quoteDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      deposit: await paymentService.quoteTripDeposit(userId(req), String(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}

export async function quoteSettlement(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      settlement: await paymentService.quoteTripSettlement(userId(req), String(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}

export async function quoteDispute(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      dispute: await paymentService.quoteTripDispute(userId(req), String(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}

export async function quoteRefund(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      refund: await paymentService.quoteTripRefund(userId(req), String(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmEscrow(req: Request, res: Response, next: NextFunction) {
  try {
    const { txHash, action } = confirmSchema.parse(req.body);
    res.json(
      await paymentService.confirmTripEscrow(userId(req), String(req.params.id), txHash, action),
    );
  } catch (error) {
    next(error);
  }
}

export async function riderWallet(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await paymentService.getRiderWallet(userId(req)));
  } catch (error) {
    next(error);
  }
}

export async function driverWallet(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await paymentService.getDriverWallet(userId(req)));
  } catch (error) {
    next(error);
  }
}

export async function withdrawWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const data = withdrawSchema.parse(req.body);
    res.status(201).json(await paymentService.withdrawDriverWallet(userId(req), data));
  } catch (error) {
    next(error);
  }
}

export async function withdrawRiderWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const data = withdrawSchema.parse(req.body);
    res.status(201).json(await paymentService.withdrawRiderWallet(userId(req), data));
  } catch (error) {
    next(error);
  }
}

export async function recordWalletTransfer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = transferSchema.parse(req.body);
    res.status(201).json(await paymentService.recordOnChainTransfer(userId(req), data));
  } catch (error) {
    next(error);
  }
}

const registerBankAccountSchema = z.object({
  accountOwnerName: z.string().trim().min(1).max(100),
  bankName: z.string().trim().min(1).max(100).optional(),
  accountType: z.enum(["us", "gb", "iban", "pix", "swift"]).optional(),
  accountNumber: z.string().trim().min(4).max(34),
  routingNumber: z.string().trim().regex(/^\d{9}$/, "US routing number must be 9 digits"),
  checkingOrSavings: z.enum(["checking", "savings"]).optional(),
  address: z.object({
    streetLine1: z.string().trim().min(1).max(150),
    streetLine2: z.string().trim().max(150).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(2).max(50),
    postalCode: z.string().trim().min(2).max(20),
    country: z.string().trim().length(3).optional(),
  }),
});

const fiatPayoutSchema = z.object({
  amount: z.coerce.number().positive().min(1).max(10000),
  fiatAccountId: z.string().trim().min(1),
  chain: z.string().trim().optional(),
  asset: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});

export async function listBankAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await privyFiatService.listExternalBankAccounts(userId(req));
    res.json({ accounts });
  } catch (error) {
    next(error);
  }
}

export async function registerBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerBankAccountSchema.parse(req.body);
    const account = await privyFiatService.registerExternalBankAccount(userId(req), data);
    res.status(201).json({ external_fiat_account: account });
  } catch (error) {
    next(error);
  }
}

export async function deleteBankAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const accountId = String(req.params.id);
    const result = await privyFiatService.deleteExternalBankAccount(userId(req), accountId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createFiatPayout(req: Request, res: Response, next: NextFunction) {
  try {
    const data = fiatPayoutSchema.parse(req.body);
    const result = await privyFiatService.executeFiatPayout(userId(req), data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getFiatPayoutStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actionId = String(req.params.actionId);
    const result = await privyFiatService.getFiatPayoutStatus(userId(req), actionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handlePrivyWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    await privyFiatService.handlePrivyWebhook(req.body);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

const swapQuoteSchema = z.object({
  chain: z.string().trim().optional(),
  tokenIn: z.string().trim().optional(),
  tokenOut: z.string().trim().optional(),
  amountIn: z.string().trim().optional(),
  sourceAsset: z.string().trim().optional(),
  destinationAsset: z.string().trim().optional(),
  sourceSymbol: z.string().trim().optional(),
  destinationSymbol: z.string().trim().optional(),
  baseAmount: z.string().trim().optional(),
  amountType: z.enum(["exact_input", "exact_output"]).optional(),
  slippageBps: z.coerce.number().optional(),
});

const swapExecuteSchema = z.object({
  chain: z.string().trim().optional(),
  tokenIn: z.string().trim().optional(),
  tokenOut: z.string().trim().optional(),
  amountIn: z.string().trim().optional(),
  sourceAsset: z.string().trim().optional(),
  destinationAsset: z.string().trim().optional(),
  sourceSymbol: z.string().trim().optional(),
  destinationSymbol: z.string().trim().optional(),
  baseAmount: z.string().trim().optional(),
  amountType: z.enum(["exact_input", "exact_output"]).optional(),
  slippageBps: z.coerce.number().optional(),
});

export async function getSwapWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const wallet = await swapService.getOrCreateSwapWallet(userId(req));
    res.json({ wallet });
  } catch (error) {
    next(error);
  }
}

export async function getSwapQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const input = swapQuoteSchema.parse(req.body);
    const quote = await swapService.getSwapQuote(userId(req), input);
    res.json({ quote });
  } catch (error) {
    next(error);
  }
}

export async function executeSwap(req: Request, res: Response, next: NextFunction) {
  try {
    const input = swapExecuteSchema.parse(req.body);
    const result = await swapService.executeManualSwap(userId(req), input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSwapActionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const actionId = String(req.params.actionId);
    const result = await swapService.getSwapActionStatus(userId(req), actionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listSwapHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await swapService.listSwapHistory(userId(req));
    res.json({ history });
  } catch (error) {
    next(error);
  }
}


