import type { Request } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { createPaginatedResponse, getPagination } from "../../utils/pagination";
import type { CreateRequestInput } from "./request.validator";

export const createRequest = async (
  callerId: string,
  data: CreateRequestInput,
) => {
  const activePending = await prisma.emergencyRequest.findFirst({
    where: { callerId, status: "PENDING", deletedAt: null },
  });
  if (activePending) {
    throw new AppError("You already have an active pending request", 409);
  }

  const {
    priority,
    pickupAddress,
    pickupLat,
    pickupLng,
    description,
    contactPhone,
    hospitalName,
  } = data;

  // Format notes with callback phone and hospital destination cleanly
  const notes = [
    description?.trim(),
    contactPhone?.trim() ? `Callback Phone: ${contactPhone.trim()}` : null,
    hospitalName?.trim() ? `Destination: ${hospitalName.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return prisma.emergencyRequest.create({
    data: {
      callerId,
      priority,
      pickupAddress,
      pickupLat,
      pickupLng,
      description: notes || null,
    },
    include: {
      caller: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
};

export const listRequests = async (req: Request) => {
  const { limit, skip, search } = getPagination(req);
  const { status, priority } = req.query as {
    status?: string;
    priority?: string;
  };

  const where: Record<string, unknown> = {
    deletedAt: null,
    ...(status && { status: status as never }),
    ...(priority && { priority: priority as never }),
  };

  if (search) {
    where.OR = [
      { pickupAddress: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { caller: { name: { contains: search, mode: "insensitive" } } },
      { caller: { email: { contains: search, mode: "insensitive" } } },
      { caller: { phone: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.emergencyRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: {
        caller: { select: { name: true, phone: true } },
        dispatch: {
          select: {
            status: true,
            ambulance: { select: { vehicleNumber: true } },
          },
        },
      },
    }),
    prisma.emergencyRequest.count({ where }),
  ]);

  return createPaginatedResponse(req, requests, total, "requests");
};

export const getRequestById = async (id: string) => {
  const request = await prisma.emergencyRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      caller: { select: { name: true, email: true, phone: true } },
      dispatch: {
        include: {
          ambulance: true,
          driver: {
            include: { user: { select: { name: true, phone: true } } },
          },
          hospital: true,
        },
      },
      payment: true,
    },
  });
  if (!request) throw new AppError("Emergency request not found", 404);
  return request;
};

export const getMyRequests = async (callerId: string, req: Request) => {
  const { limit, skip, search } = getPagination(req);
  const { status } = req.query as { status?: string };

  const where: Record<string, unknown> = {
    callerId,
    deletedAt: null,
    ...(status && { status: status as never }),
  };

  if (search) {
    where.OR = [
      { pickupAddress: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.emergencyRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        dispatch: { select: { status: true } },
        payment: { select: { status: true, amount: true } },
      },
    }),
    prisma.emergencyRequest.count({ where }),
  ]);

  return createPaginatedResponse(req, requests, total, "requests");
};

export const cancelRequest = async (
  id: string,
  callerId: string,
  role: string,
) => {
  const request = await getRequestById(id);

  if (role !== "ADMIN" && request.callerId !== callerId) {
    throw new AppError(
      "You do not have permission to cancel this request",
      403,
    );
  }

  if (request.status !== "PENDING") {
    throw new AppError("Only PENDING requests can be cancelled", 400);
  }

  return prisma.emergencyRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
};
