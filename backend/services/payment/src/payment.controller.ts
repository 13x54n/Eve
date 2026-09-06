import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@eve/http";
import * as paymentService from "./payment.service.js";

function userId(req: Request) {
  return (req as AuthenticatedRequest).user.id;
}

const confirmSchema = z.object({
  txHash: z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
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

export async function confirmDeposit(req: Request, res: Response, next: NextFunction) {
  try {
    const { txHash } = confirmSchema.parse(req.body);
    res.json(await paymentService.confirmTripDeposit(userId(req), String(req.params.id), txHash));
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

export async function releaseInternal(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await paymentService.releaseTripEscrow(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function refundInternal(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await paymentService.refundTripEscrow(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}
