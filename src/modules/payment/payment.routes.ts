import express, { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as paymentController from "./payment.controller";
import {
  createBkashCheckoutSchema,
  createCheckoutSchema,
  executeBkashSchema,
  getFareSchema,
  initSSLCommerzSchema,
  listPaymentsQuerySchema,
} from "./payment.validator";

const router = Router();

// POST /api/v1/payments/stripe/webhook (or /webhook) — Stripe webhook (raw body, no auth)
router.post(
  ["/stripe/webhook", "/webhook"],
  express.raw({ type: "application/json" }),
  paymentController.stripeWebhook,
);

// POST /api/v1/payments/stripe/checkout (or /checkout) — Patient initiates Stripe checkout
router.post(
  ["/stripe/checkout", "/checkout"],
  authenticate,
  authorize("PATIENT"),
  validate(createCheckoutSchema),
  paymentController.createCheckout,
);

// POST /api/v1/payments/bkash/create — Patient creates bKash payment URL
router.post(
  "/bkash/create",
  authenticate,
  authorize("PATIENT"),
  validate(createBkashCheckoutSchema),
  paymentController.createBkashCheckout,
);

// POST /api/v1/payments/bkash/execute — Patient executes/captures bKash payment
router.post(
  "/bkash/execute",
  authenticate,
  authorize("PATIENT"),
  validate(executeBkashSchema),
  paymentController.executeBkash,
);

// ALL /api/v1/payments/bkash/callback — bKash browser redirect callback (no auth, gateway redirect)
router.all("/bkash/callback", paymentController.bkashCallback);

// POST /api/v1/payments/sslcommerz/initiate — Patient initializes SSLCommerz payment
router.post(
  "/sslcommerz/initiate",
  authenticate,
  authorize("PATIENT"),
  validate(initSSLCommerzSchema),
  paymentController.initSSLCommerz,
);

// ALL /api/v1/payments/sslcommerz/success — SSLCommerz browser return (success)
router.all("/sslcommerz/success", paymentController.sslcommerzSuccess);

// ALL /api/v1/payments/sslcommerz/fail — SSLCommerz browser return (fail)
router.all("/sslcommerz/fail", paymentController.sslcommerzFail);

// ALL /api/v1/payments/sslcommerz/cancel — SSLCommerz browser return (cancel)
router.all("/sslcommerz/cancel", paymentController.sslcommerzCancel);

// POST /api/v1/payments/sslcommerz/ipn — SSLCommerz IPN webhook
router.post("/sslcommerz/ipn", paymentController.sslcommerzIPN);

// POST /api/v1/payments/cash-confirm — Driver or Admin confirms cash settlement at hospital bay
router.post(
  "/cash-confirm",
  authenticate,
  authorize("DRIVER", "ADMIN"),
  paymentController.confirmCashPayment,
);

// GET /api/v1/payments/fare/:requestId — Patient, Driver, or Admin views calculated fare estimate
router.get(
  "/fare/:requestId",
  authenticate,
  authorize("PATIENT", "ADMIN", "DRIVER"),
  validate(getFareSchema),
  paymentController.getFareEstimate,
);

// GET /api/v1/payments/my — Patient views their payment history, Admin views all payments
router.get(
  "/my",
  authenticate,
  authorize("PATIENT", "ADMIN"),
  validate(listPaymentsQuerySchema),
  paymentController.getMyPayments,
);

// GET /api/v1/payments/:requestId — Patient, Driver, or Admin views payment status
router.get(
  "/:requestId",
  authenticate,
  authorize("PATIENT", "ADMIN", "DRIVER"),
  paymentController.getPaymentStatus,
);

export default router;
