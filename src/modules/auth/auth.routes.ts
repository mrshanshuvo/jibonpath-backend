import { Router } from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import "../../config/passport";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt";
import * as authController from "./auth.controller";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "./auth.validator";

const router = Router();

// Stricter rate limiter for sensitive authentication endpoints (15 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many authentication attempts, please try again after 15 minutes",
    errors: [],
  },
});

// POST /api/v1/auth/register
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

// POST /api/v1/auth/login
router.post("/login", authLimiter, validate(loginSchema), authController.login);

// POST /api/v1/auth/logout — requires auth
router.post("/logout", authenticate, authController.logout);

// POST /api/v1/auth/refresh-token
router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  authController.refreshToken,
);

// GET /api/v1/auth/google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

// GET /api/v1/auth/google/callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/v1/auth/google/failure",
    session: false,
  }),
  (req, res) => {
    const user = req.user as Express.User;
    const accessToken = generateAccessToken({
      userId: user.userId,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.userId,
      role: user.role,
    });

    res.json({
      success: true,
      message: "Google login successful",
      data: { accessToken, refreshToken },
    });
  },
);

// GET /api/v1/auth/google/failure
router.get("/google/failure", (_req, res) => {
  res.status(401).json({
    success: false,
    message: "Google authentication failed",
    errors: [],
  });
});

export default router;
