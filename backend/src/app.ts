import "dotenv/config";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
} from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/api/auth", authRoutes);

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Invalid request data",
      errors: error.issues,
    });
    return;
  }

  if (error?.name === "ConflictError") {
    res.status(409).json({
      message: error.message,
    });
    return;
  }

  if (error?.name === "UnauthorizedError") {
    res.status(401).json({
      message: error.message,
    });
    return;
  }

  if (error?.name === "NotFoundError") {
    res.status(404).json({
      message: error.message,
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    message: "Internal server error",
  });
};

app.use(errorHandler);

export default app;