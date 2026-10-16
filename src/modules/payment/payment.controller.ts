import type { Request, Response } from "express";
import { prisma } from "../../config/db";
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

// ALL /api/v1/payments/bkash/callback (bKash browser redirect callback)
export const bkashCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentID = (req.query.paymentID || req.body?.paymentID) as string;
    const status = (
      (req.query.status || req.body?.status || "") as string
    ).toLowerCase();

    const clientBaseUrl = envConfig.clientUrl.replace(/\/+$/, "");

    if (!paymentID) {
      if (
        req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html")
      ) {
        throw new AppError("Missing paymentID in callback", 400);
      }
      return res.redirect(
        `${clientBaseUrl}/payment/cancel?gateway=BKASH&status=missing_payment_id`,
      );
    }

    try {
      if (status === "success") {
        const result = await paymentService.processBkashCallback(
          paymentID,
          "success",
        );

        if (
          req.headers.accept?.includes("application/json") &&
          !req.headers.accept?.includes("text/html")
        ) {
          return sendSuccess(
            res,
            "bKash payment executed successfully",
            result,
          );
        }

        return res.redirect(
          `${clientBaseUrl}/payment/success?paymentID=${encodeURIComponent(paymentID)}&gateway=BKASH&trxID=${encodeURIComponent(result.trxID || "")}&requestId=${encodeURIComponent(result.requestId || "")}`,
        );
      }

      const result = await paymentService.processBkashCallback(
        paymentID,
        status || "failure",
      );

      if (
        req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html")
      ) {
        return sendSuccess(
          res,
          "bKash payment failed or cancelled",
          result,
          400,
        );
      }

      return res.redirect(
        `${clientBaseUrl}/payment/cancel?gateway=BKASH&status=${encodeURIComponent(status || "failure")}&paymentID=${encodeURIComponent(paymentID)}&requestId=${encodeURIComponent(result.requestId || "")}`,
      );
    } catch (error: unknown) {
      if (
        req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html")
      ) {
        throw error;
      }
      const errMessage =
        error instanceof Error ? error.message : "Payment execution failed";
      const payment = await prisma.payment.findFirst({
        where: { sessionId: paymentID },
      });
      return res.redirect(
        `${clientBaseUrl}/payment/cancel?gateway=BKASH&status=failure&paymentID=${encodeURIComponent(paymentID)}&requestId=${encodeURIComponent(payment?.requestId || "")}&error=${encodeURIComponent(errMessage)}`,
      );
    }
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

    const isBrowser =
      Boolean(req.headers.accept?.includes("text/html")) ||
      Boolean(req.is("application/x-www-form-urlencoded"));

    if (isBrowser) {
      const clientBaseUrl = envConfig.clientUrl.replace(/\/+$/, "");
      return res.redirect(
        `${clientBaseUrl}/payment/success?requestId=${encodeURIComponent(requestId)}&gateway=SSLCOMMERZ&tran_id=${encodeURIComponent(result.tranId)}`,
      );
    }

    sendSuccess(res, "SSLCommerz payment validated and completed", result);
  },
);

// POST /api/v1/payments/sslcommerz/fail
export const sslcommerzFail = asyncHandler(
  async (req: Request, res: Response) => {
    const requestId =
      (req.query.requestId as string) || (req.body?.value_a as string) || "";
    const isBrowser =
      Boolean(req.headers.accept?.includes("text/html")) ||
      Boolean(req.is("application/x-www-form-urlencoded"));

    if (isBrowser) {
      const clientBaseUrl = envConfig.clientUrl.replace(/\/+$/, "");
      return res.redirect(
        `${clientBaseUrl}/payment/cancel?gateway=SSLCOMMERZ&status=failure&requestId=${encodeURIComponent(requestId)}`,
      );
    }

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
    const requestId =
      (req.query.requestId as string) || (req.body?.value_a as string) || "";
    const isBrowser =
      Boolean(req.headers.accept?.includes("text/html")) ||
      Boolean(req.is("application/x-www-form-urlencoded"));

    if (isBrowser) {
      const clientBaseUrl = envConfig.clientUrl.replace(/\/+$/, "");
      return res.redirect(
        `${clientBaseUrl}/payment/cancel?gateway=SSLCOMMERZ&status=cancelled&requestId=${encodeURIComponent(requestId)}`,
      );
    }

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
    sendSuccess(res, "Payment history fetched successfully", result);
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

// POST /api/v1/payments/cash-confirm
export const confirmCashPayment = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user?.userId || !req.user?.role)
      throw new AppError("Unauthorized", 401);
    const { requestId } = req.body;
    if (!requestId) {
      throw new AppError("requestId is required", 400);
    }
    const payment = await paymentService.confirmCashPayment(
      requestId,
      req.user.userId,
      req.user.role,
    );
    sendSuccess(res, "Cash payment confirmed successfully at bay", payment);
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
