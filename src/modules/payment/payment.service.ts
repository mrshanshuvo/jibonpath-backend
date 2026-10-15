import type { Request } from "express";
import type Stripe from "stripe";
import { prisma } from "../../config/db";
import { stripe } from "../../config/stripe";
import { AppError } from "../../utils/AppError";
import * as bkashHelper from "../../utils/bkash";
import {
  type FareBreakdown,
  calculateTripFare,
} from "../../utils/fareCalculator";
import { buildMeta, getPagination } from "../../utils/pagination";
import * as sslcommerzHelper from "../../utils/sslcommerz";
import type {
  CreateBkashCheckoutInput,
  CreateCheckoutInput,
  ExecuteBkashInput,
  InitSSLCommerzInput,
} from "./payment.validator";

// ─── Dynamic Fare Estimation ─────────────────────────────────────────────────

export const getCalculatedFareForRequest = async (
  requestId: string,
  callerId?: string,
  userRole?: string,
): Promise<{ request: unknown; fare: FareBreakdown }> => {
  const request = await prisma.emergencyRequest.findFirst({
    where: {
      id: requestId,
      deletedAt: null,
      ...(userRole !== "ADMIN" && callerId ? { callerId } : {}),
    },
    include: {
      dispatch: {
        include: {
          ambulance: true,
          hospital: true,
        },
      },
    },
  });

  if (!request) {
    throw new AppError("Emergency request not found", 404);
  }

  const ambulanceType = request.dispatch?.ambulance?.type ?? "BASIC";
  const fare = calculateTripFare({
    ambulanceType,
    priority: request.priority,
    pickupLat: request.pickupLat,
    pickupLng: request.pickupLng,
    hospitalLat: request.dispatch?.hospital?.lat,
    hospitalLng: request.dispatch?.hospital?.lng,
  });

  return {
    request: {
      id: request.id,
      priority: request.priority,
      status: request.status,
      pickupAddress: request.pickupAddress,
      ambulance: request.dispatch?.ambulance
        ? {
            vehicleNumber: request.dispatch.ambulance.vehicleNumber,
            type: request.dispatch.ambulance.type,
          }
        : null,
      hospital: request.dispatch?.hospital
        ? {
            name: request.dispatch.hospital.name,
            address: request.dispatch.hospital.address,
          }
        : null,
    },
    fare,
  };
};

// ─── Create Stripe Checkout Session ──────────────────────────────────────────

export const createCheckoutSession = async (
  callerId: string,
  data: CreateCheckoutInput,
) => {
  const request = await prisma.emergencyRequest.findFirst({
    where: { id: data.requestId, callerId, deletedAt: null },
    include: {
      payment: true,
      dispatch: {
        include: {
          ambulance: true,
          hospital: true,
        },
      },
    },
  });
  if (!request) {
    throw new AppError("Emergency request not found", 404);
  }

  if (request.payment && request.payment.status === "SUCCESS") {
    throw new AppError("This request has already been paid", 409);
  }

  if (!["DISPATCHED", "COMPLETED"].includes(request.status)) {
    throw new AppError(
      "Payment is only allowed for dispatched or completed requests",
      400,
    );
  }

  // Calculate authoritative fare if amount is not specified
  let finalAmount = data.amount;
  if (!finalAmount) {
    const ambulanceType = request.dispatch?.ambulance?.type ?? "BASIC";
    const fare = calculateTripFare({
      ambulanceType,
      priority: request.priority,
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
      hospitalLat: request.dispatch?.hospital?.lat,
      hospitalLng: request.dispatch?.hospital?.lng,
    });
    finalAmount = fare.totalFare;
  }

  const amountInPaisa = Math.round(finalAmount * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: data.currency.toLowerCase(),
          product_data: {
            name: "Emergency Ambulance Service",
            description: `Request ID: ${data.requestId} | Pickup: ${request.pickupAddress}`,
          },
          unit_amount: amountInPaisa,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: {
      requestId: data.requestId,
      callerId,
    },
    success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/cancel`,
  });

  const payment = await prisma.payment.upsert({
    where: { requestId: data.requestId },
    update: {
      amount: finalAmount,
      currency: data.currency.toUpperCase(),
      gateway: "STRIPE",
      sessionId: session.id,
      status: "PENDING",
    },
    create: {
      requestId: data.requestId,
      amount: finalAmount,
      currency: data.currency.toUpperCase(),
      gateway: "STRIPE",
      sessionId: session.id,
      status: "PENDING",
    },
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    amount: finalAmount,
    payment,
  };
};

// ─── Create bKash Checkout Session ───────────────────────────────────────────

export const createBkashCheckout = async (
  callerId: string,
  data: CreateBkashCheckoutInput,
) => {
  const request = await prisma.emergencyRequest.findFirst({
    where: { id: data.requestId, callerId, deletedAt: null },
    include: {
      payment: true,
      dispatch: {
        include: {
          ambulance: true,
          hospital: true,
        },
      },
    },
  });
  if (!request) {
    throw new AppError("Emergency request not found", 404);
  }

  if (request.payment && request.payment.status === "SUCCESS") {
    throw new AppError("This request has already been paid", 409);
  }

  if (!["DISPATCHED", "COMPLETED"].includes(request.status)) {
    throw new AppError(
      "Payment is only allowed for dispatched or completed requests",
      400,
    );
  }

  // Calculate authoritative fare if amount is not specified
  let finalAmount = data.amount;
  if (!finalAmount) {
    const ambulanceType = request.dispatch?.ambulance?.type ?? "BASIC";
    const fare = calculateTripFare({
      ambulanceType,
      priority: request.priority,
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
      hospitalLat: request.dispatch?.hospital?.lat,
      hospitalLng: request.dispatch?.hospital?.lng,
    });
    finalAmount = fare.totalFare;
  }

  const bkashRes = await bkashHelper.createBkashPayment({
    amount: finalAmount,
    requestId: data.requestId,
    payerReference: data.payerReference,
  });

  const payment = await prisma.payment.upsert({
    where: { requestId: data.requestId },
    update: {
      amount: finalAmount,
      currency: "BDT",
      gateway: "BKASH",
      sessionId: bkashRes.paymentID,
      status: "PENDING",
    },
    create: {
      requestId: data.requestId,
      amount: finalAmount,
      currency: "BDT",
      gateway: "BKASH",
      sessionId: bkashRes.paymentID,
      status: "PENDING",
    },
  });

  return {
    paymentID: bkashRes.paymentID,
    bkashURL: bkashRes.bkashURL,
    amount: finalAmount,
    payment,
  };
};

// ─── Execute bKash Payment (Callback / Capture) ──────────────────────────────

export const executeBkashPayment = async (
  callerId: string,
  data: ExecuteBkashInput,
) => {
  const request = await prisma.emergencyRequest.findFirst({
    where: { id: data.requestId, callerId, deletedAt: null },
  });
  if (!request) {
    throw new AppError("Emergency request not found", 404);
  }

  const execRes = await bkashHelper.executeBkashPayment(data.paymentID);

  const payment = await prisma.payment.update({
    where: { requestId: data.requestId },
    data: {
      status: "SUCCESS",
      gatewayTxnId: execRes.trxID,
    },
  });

  await prisma.emergencyRequest.updateMany({
    where: { id: data.requestId, status: { in: ["DISPATCHED", "PENDING"] } },
    data: { status: "COMPLETED" },
  });

  return {
    trxID: execRes.trxID,
    amount: execRes.amount,
    status: payment.status,
    payment,
  };
};

// ─── Process bKash Browser Callback ───────────────────────────────────────────

export const processBkashCallback = async (
  paymentID: string,
  status: string,
) => {
  const payment = await prisma.payment.findFirst({
    where: { sessionId: paymentID },
  });

  const normalizedStatus = (status || "").toLowerCase();

  if (normalizedStatus === "success") {
    if (payment?.status === "SUCCESS") {
      return {
        success: true,
        requestId: payment.requestId,
        paymentID,
        trxID: payment.gatewayTxnId || "",
      };
    }

    const execRes = await bkashHelper.executeBkashPayment(paymentID);

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          gatewayTxnId: execRes.trxID,
        },
      });

      await prisma.emergencyRequest.updateMany({
        where: {
          id: payment.requestId,
          status: { in: ["DISPATCHED", "PENDING"] },
        },
        data: { status: "COMPLETED" },
      });
    }

    return {
      success: true,
      requestId: payment?.requestId,
      paymentID,
      trxID: execRes.trxID,
    };
  }

  if (payment && payment.status === "PENDING") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
      },
    });
  }

  return {
    success: false,
    requestId: payment?.requestId,
    paymentID,
    status: normalizedStatus || "failure",
  };
};

// ─── Initialize SSLCommerz Payment ───────────────────────────────────────────

export const initSSLCommerzPayment = async (
  callerId: string,
  data: InitSSLCommerzInput,
) => {
  const request = await prisma.emergencyRequest.findFirst({
    where: { id: data.requestId, callerId, deletedAt: null },
    include: {
      caller: true,
      payment: true,
      dispatch: {
        include: {
          ambulance: true,
          hospital: true,
        },
      },
    },
  });
  if (!request) {
    throw new AppError("Emergency request not found", 404);
  }

  if (request.payment && request.payment.status === "SUCCESS") {
    throw new AppError("This request has already been paid", 409);
  }

  if (!["DISPATCHED", "COMPLETED"].includes(request.status)) {
    throw new AppError(
      "Payment is only allowed for dispatched or completed requests",
      400,
    );
  }

  // Calculate authoritative fare if amount is not specified
  let finalAmount = data.amount;
  if (!finalAmount) {
    const ambulanceType = request.dispatch?.ambulance?.type ?? "BASIC";
    const fare = calculateTripFare({
      ambulanceType,
      priority: request.priority,
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
      hospitalLat: request.dispatch?.hospital?.lat,
      hospitalLng: request.dispatch?.hospital?.lng,
    });
    finalAmount = fare.totalFare;
  }

  const sslRes = await sslcommerzHelper.initSSLCommerzPayment({
    amount: finalAmount,
    requestId: data.requestId,
    customerName: request.caller.name,
    customerEmail: request.caller.email,
    customerPhone: request.caller.phone || undefined,
    customerAddress: request.pickupAddress,
  });

  const payment = await prisma.payment.upsert({
    where: { requestId: data.requestId },
    update: {
      amount: finalAmount,
      currency: "BDT",
      gateway: "SSLCOMMERZ",
      sessionId: sslRes.sessionkey,
      status: "PENDING",
    },
    create: {
      requestId: data.requestId,
      amount: finalAmount,
      currency: "BDT",
      gateway: "SSLCOMMERZ",
      sessionId: sslRes.sessionkey,
      status: "PENDING",
    },
  });

  return {
    gatewayUrl: sslRes.GatewayPageURL,
    gatewayPageURL: sslRes.GatewayPageURL,
    GatewayPageURL: sslRes.GatewayPageURL,
    url: sslRes.GatewayPageURL,
    sessionKey: sslRes.sessionkey,
    sessionkey: sslRes.sessionkey,
    amount: finalAmount,
    payment,
  };
};

// ─── Validate & Finalize SSLCommerz Payment ──────────────────────────────────

export const finalizeSSLCommerzPayment = async (
  requestId: string,
  valId: string,
) => {
  const validationRes = await sslcommerzHelper.validateSSLCommerzPayment(valId);

  const payment = await prisma.payment.update({
    where: { requestId },
    data: {
      status: "SUCCESS",
      gatewayTxnId: validationRes.tran_id,
    },
  });

  await prisma.emergencyRequest.updateMany({
    where: { id: requestId, status: { in: ["DISPATCHED", "PENDING"] } },
    data: { status: "COMPLETED" },
  });

  return {
    tranId: validationRes.tran_id,
    amount: validationRes.amount,
    cardType: validationRes.card_type,
    status: payment.status,
    payment,
  };
};

// ─── Get Payment Status for a Request ────────────────────────────────────────

export const getPaymentByRequestId = async (
  identifier: string,
  callerId: string,
  role: string,
) => {
  // 1. Check if identifier is a payment ID, session ID, or requestId
  let payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { id: identifier },
        { requestId: identifier },
        { sessionId: identifier },
      ],
    },
  });

  const effectiveRequestId = payment?.requestId || identifier;

  const request = await prisma.emergencyRequest.findFirst({
    where: { id: effectiveRequestId, deletedAt: null },
  });
  if (!request) throw new AppError("Emergency request not found", 404);

  if (role !== "ADMIN" && request.callerId !== callerId) {
    throw new AppError("Access denied", 403);
  }

  if (!payment) {
    payment = await prisma.payment.findUnique({
      where: { requestId: effectiveRequestId },
    });
  }

  if (!payment) throw new AppError("No payment found for this request", 404);

  return payment;
};

// ─── Handle Stripe Webhook Events ────────────────────────────────────────────

export const handleStripeWebhook = async (
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new AppError(
      `Webhook signature verification failed: ${(err as Error).message}`,
      400,
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const requestId = session.metadata?.requestId;
      if (!requestId) break;

      await prisma.payment.updateMany({
        where: { requestId },
        data: {
          status: "SUCCESS",
          gatewayTxnId: session.payment_intent as string,
        },
      });

      await prisma.emergencyRequest.updateMany({
        where: {
          id: requestId,
          status: { in: ["DISPATCHED", "PENDING"] },
        },
        data: { status: "COMPLETED" },
      });

      console.log(`✅ Payment SUCCESS for request: ${requestId}`);
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const requestId = session.metadata?.requestId;
      if (!requestId) break;

      await prisma.payment.updateMany({
        where: { requestId, status: "PENDING" },
        data: { status: "FAILED" },
      });

      console.log(`❌ Payment EXPIRED for request: ${requestId}`);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const requestId = paymentIntent.metadata?.requestId;
      if (!requestId) break;

      await prisma.payment.updateMany({
        where: { requestId, status: "PENDING" },
        data: {
          status: "FAILED",
          gatewayTxnId: paymentIntent.id,
        },
      });

      console.log(`❌ Payment FAILED for request: ${requestId}`);
      break;
    }

    default:
      console.log(`Stripe webhook: unhandled event type ${event.type}`);
  }

  return { received: true };
};

// ─── Patient Payment History ──────────────────────────────────────────────────

export const getMyPayments = async (
  userId: string,
  userRole: string,
  req: Request,
) => {
  const { page, limit, skip } = getPagination(req);
  const { status } = req.query as { status?: string };

  const where = {
    ...(userRole !== "ADMIN" && {
      request: {
        callerId: userId,
        deletedAt: null,
      },
    }),
    ...(status && { status: status as never }),
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          select: {
            id: true,
            pickupAddress: true,
            priority: true,
            status: true,
            createdAt: true,
            caller: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    payments,
    meta: buildMeta(page, limit, total),
  };
};
