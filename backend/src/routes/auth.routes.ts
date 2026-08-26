import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  adminLogin,
  forgotPassword,
  login,
  me,
  register,
  resetPasswordHandler,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

import {
  register as driverRegister,
  login as driverLogin,
} from "../controllers/driver.controller.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/driver/register", authLimiter, driverRegister);
router.post("/driver/login", authLimiter, driverLogin);
router.post("/admin/login", authLimiter, adminLogin);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordHandler);
router.get("/me", requireAuth, me);

export default router;