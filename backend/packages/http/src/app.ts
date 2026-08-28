import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";

export function createBaseApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan("dev"));
  app.use(express.json({ limit: "10kb" }));
  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid request data",
      errors: error.issues,
    });
    return;
  }

  if (error?.name === "ConflictError") {
    res.status(409).json({ message: error.message });
    return;
  }

  if (error?.name === "UnauthorizedError") {
    res.status(401).json({ message: error.message });
    return;
  }

  if (error?.name === "NotFoundError") {
    res.status(404).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};

export function applyErrorHandler(app: Express) {
  app.use(errorHandler);
}
