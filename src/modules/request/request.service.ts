import type { Request } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { buildMeta, getPagination } from "../../utils/pagination";
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

  // Format destination and callback notes into description if provided
  const noteParts: string[] = [];
  if (data.hospitalName && data.hospitalName !== "Closest Available Emergency Room") {
    noteParts.push(`[Hospital: ${data.hospitalName}]`);
  }
  if (data.contactPhone) {
    noteParts.push(`[Callback: ${data.contactPhone}]`);
  }
  if (data.description?.trim()) {
    noteParts.push(data.description.trim());
  }

  const finalDescription = noteParts.length > 0 ? noteParts.join(" ") : null;

  // Persist callback phone to user profile if not previously set
  if (data.contactPhone) {
    await prisma.user.updateMany({
      where: { id: callerId, phone: null },
      data: { phone: data.contactPhone },
    });
  }

  return prisma.emergencyRequest.create({
    data: {
      callerId,
      priority: data.priority,
      pickupAddress: data.pickupAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      description: finalDescription,
    },
  });
};

export const listRequests = async (req: Request) => {
  const { page, limit, skip } = getPagination(req);
  const { status, priority } = req.query as {
    status?: string;
    priority?: string;
  };

  const where = {
    deletedAt: null,
    ...(status && { status: status as never }),
    ...(priority && { priority: priority as never }),
  };

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

  return { requests, meta: buildMeta(page, limit, total) };
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
  const { page, limit, skip } = getPagination(req);

  const [requests, total] = await Promise.all([
    prisma.emergencyRequest.findMany({
      where: { callerId, deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        dispatch: { select: { status: true } },
        payment: { select: { status: true, amount: true } },
      },
    }),
    prisma.emergencyRequest.count({ where: { callerId, deletedAt: null } }),
  ]);

  return { requests, meta: buildMeta(page, limit, total) };
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
