import type { Request, Response } from "express";
import { envConfig } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { logAudit } from "../../utils/auditLogger";
import { sendSuccess } from "../../utils/response";
import * as paymentService from "./payment.service";

// POST /api/v1/payments/stripe/checkout
export const createCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await paymentService.createCheckoutSession(
      req.user.userId,
      req.body,
    );
    await logAudit(
      req.user.userId,
      "CREATE_CHECKOUT",
      "Payment",
      result.payment.id,
      { sessionId: result.sessionId, gateway: "STRIPE" },
    );
    sendSuccess(res, "Checkout session created successfully", result, 201);
  },
);

// POST /api/v1/payments/bkash/create
export const createBkashCheckout = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await paymentService.createBkashCheckout(
      req.user.userId,
      req.body,
    );
    await logAudit(
      req.user.userId,
      "CREATE_BKASH_CHECKOUT",
      "Payment",
      result.payment.id,
      { paymentID: result.paymentID, gateway: "BKASH" },
    );
    sendSuccess(res, "bKash checkout URL generated successfully", result, 201);
  },
);

// POST /api/v1/payments/bkash/execute
export const executeBkash = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await paymentService.executeBkashPayment(
      req.user.userId,
      req.body,
    );
    await logAudit(
      req.user.userId,
      "EXECUTE_BKASH_PAYMENT",
      "Payment",
      result.payment.id,
      { trxID: result.trxID },
    );
    sendSuccess(res, "bKash payment executed successfully", result);
  },
);

// POST /api/v1/payments/sslcommerz/initiate
export const initSSLCommerz = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await paymentService.initSSLCommerzPayment(
      req.user.userId,
      req.body,
    );
    await logAudit(
      req.user.userId,
      "INITIATE_SSLCOMMERZ_PAYMENT",
      "Payment",
      result.payment.id,
      { sessionkey: result.sessionkey, gateway: "SSLCOMMERZ" },
    );
    sendSuccess(
      res,
      "SSLCommerz session initialized successfully",
      result,
      201,
    );
  },
);

// POST /api/v1/payments/sslcommerz/success (Browser callback from SSLCommerz)
export const sslcommerzSuccess = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId =
      (req.query.requestId as string) || (req.body?.value_a as string);
    const val_id = req.body?.val_id || req.query?.val_id;

    if (!requestId || !val_id) {
      throw new AppError("Invalid SSLCommerz success payload", 400);
    }

    const result = await paymentService.finalizeSSLCommerzPayment(
      requestId,
      val_id,
    );
    sendSuccess(res, "SSLCommerz payment validated and completed", result);
  },
);

// POST /api/v1/payments/sslcommerz/fail
export const sslcommerzFail = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = req.query.requestId as string;
    sendSuccess(
      res,
      "SSLCommerz payment failed",
      { requestId, status: "FAILED" },
      400,
    );
  },
);

// POST /api/v1/payments/sslcommerz/cancel
export const sslcommerzCancel = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId = req.query.requestId as string;
    sendSuccess(
      res,
      "SSLCommerz payment was cancelled by user",
      { requestId, status: "CANCELLED" },
      200,
    );
  },
);

// POST /api/v1/payments/sslcommerz/ipn (Instant Payment Notification)
export const sslcommerzIPN = asyncHandler(
  async (req: Request, res: Response) => {
    const { val_id, status } = req.body;
    if (val_id && (status === "VALID" || status === "VALIDATED")) {
      const payment = await paymentService.finalizeSSLCommerzPayment(
        req.body.value_a || "",
        val_id,
      );
      res.json({ success: true, payment });
      return;
    }
    res.json({ success: true, received: true });
  },
);

// GET /api/v1/payments/fare/:requestId — Itemized fare quotation
export const getFareEstimate = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await paymentService.getCalculatedFareForRequest(
      req.params.requestId,
      req.user.userId,
      req.user.role,
    );
    sendSuccess(res, "Fare calculated successfully", result);
  },
);

// GET /api/v1/payments/my — Patient views their payment history, Admin views all payments
export const getMyPayments = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId || !req.user?.role)
      throw new AppError("Unauthorized", 401);
    const result = await paymentService.getMyPayments(
      req.user.userId,
      req.user.role,
      req,
    );
    sendSuccess(res, "Payment history fetched successfully", {
      payments: result.payments,
      meta: result.meta,
    });
  },
);

// GET /api/v1/payments/:requestId
export const getPaymentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId || !req.user?.role)
      throw new AppError("Unauthorized", 401);
    const payment = await paymentService.getPaymentByRequestId(
      req.params.requestId,
      req.user.userId,
      req.user.role,
    );
    sendSuccess(res, "Payment status fetched successfully", payment);
  },
);

// POST /api/v1/payments/stripe/webhook
export const stripeWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      throw new AppError("Missing stripe-signature header", 400);
    }
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody ||
      (Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body)));
    const result = await paymentService.handleStripeWebhook(
      rawBody,
      signature,
      envConfig.stripe.webhookSecret,
    );
    res.json(result);
  },
);
