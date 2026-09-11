import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@eve/http";
import * as paymentService from "./payment.service.js";

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

const swapSchema = z.object({
  tokenIn: z.string().trim().min(1),
  tokenOut: z.string().trim().min(1),
  amountIn: z.coerce.number().positive().max(100000),
});

export async function estimateSwap(req: Request, res: Response, next: NextFunction) {
  try {
    const data = swapSchema.parse(req.body);
    res.json(await paymentService.estimateDriverSwap(userId(req), data));
  } catch (error) {
    next(error);
  }
}

export async function executeSwap(req: Request, res: Response, next: NextFunction) {
  try {
    const data = swapSchema.parse(req.body);
    res.status(201).json(await paymentService.executeDriverSwap(userId(req), data));
  } catch (error) {
    next(error);
  }
}
