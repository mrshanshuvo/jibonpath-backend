import type { Request } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { createPaginatedResponse, getPagination } from "../../utils/pagination";
import { calculateTripFare } from "../../utils/fareCalculator";
import type {
  CreateDispatchInput,
  RecordLocationInput,
  UpdateDispatchStatusInput,
} from "./dispatch.validator";
import { telemetryStore, type TelemetryTick } from "./telemetry.store";

export const createDispatch = async (data: CreateDispatchInput) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.emergencyRequest.findFirst({
      where: { id: data.requestId, status: "PENDING" },
    });
    if (!request)
      throw new AppError("Request not found or not in PENDING status", 400);

    const ambulance = await tx.ambulance.findFirst({
      where: { id: data.ambulanceId, status: "AVAILABLE" },
    });
    if (!ambulance) throw new AppError("Ambulance is not available", 400);

    const driver = await tx.driver.findFirst({
      where: { id: data.driverId, isAvailable: true },
    });
    if (!driver) throw new AppError("Driver is not available", 400);

    const existing = await tx.dispatch.findUnique({
      where: { requestId: data.requestId },
    });
    if (existing) throw new AppError("This request is already dispatched", 409);

    await tx.emergencyRequest.update({
      where: { id: data.requestId },
      data: { status: "DISPATCHED" },
    });

    await tx.ambulance.update({
      where: { id: data.ambulanceId },
      data: { status: "DISPATCHED" },
    });
    await tx.driver.update({
      where: { id: data.driverId },
      data: { isAvailable: false },
    });

    const dispatch = await tx.dispatch.create({
      data: { ...data },
    });

    await tx.tripStatusLog.create({
      data: {
        dispatchId: dispatch.id,
        status: "DISPATCHED",
        note: "Dispatch initiated by admin",
        updatedByUserId: driver.userId,
      },
    });

    return dispatch;
  });
};

export const getDispatchById = async (id: string, requesterUserId?: string, requesterRole?: string) => {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      request: {
        select: {
          id: true,
          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          priority: true,
          status: true,
          callerId: true,
          description: true,
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              gateway: true,
              status: true,
              gatewayTxnId: true,
            },
          },
          caller: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      },
      ambulance: {
        select: {
          id: true,
          vehicleNumber: true,
          type: true,
          status: true,
        },
      },
      driver: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      hospital: true,
      tripStatusLogs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!dispatch) throw new AppError("Dispatch not found", 404);

  // If requester is a PATIENT, ensure they own the request
  if (requesterRole === "PATIENT" && requesterUserId && dispatch.request.callerId !== requesterUserId) {
    throw new AppError("Forbidden: You do not have permission to view this dispatch", 403);
  }

  const latestTelemetry = await telemetryStore.getLatestTelemetry(id);
  return { ...dispatch, latestTelemetry };
};

export const getDispatchByRequestId = async (requestId: string, requesterUserId?: string, requesterRole?: string) => {
  const dispatch = await prisma.dispatch.findUnique({
    where: { requestId },
    include: {
      request: {
        select: {
          id: true,
          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          priority: true,
          status: true,
          callerId: true,
          description: true,
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              gateway: true,
              status: true,
              gatewayTxnId: true,
            },
          },
          caller: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      },
      ambulance: {
        select: {
          id: true,
          vehicleNumber: true,
          type: true,
          status: true,
        },
      },
      driver: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      hospital: true,
      tripStatusLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!dispatch) throw new AppError("Dispatch for this request was not found", 404);

  if (requesterRole === "PATIENT" && requesterUserId && dispatch.request.callerId !== requesterUserId) {
    throw new AppError("Forbidden: You do not have permission to view this dispatch", 403);
  }

  const latestTelemetry = await telemetryStore.getLatestTelemetry(dispatch.id);
  return { ...dispatch, latestTelemetry };
};

export const recordLocation = async (
  dispatchId: string,
  data: RecordLocationInput,
  actorUserId: string,
  actorRole: string,
): Promise<TelemetryTick> => {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: { driver: true },
  });

  if (!dispatch) throw new AppError("Dispatch not found", 404);

  if (actorRole === "DRIVER" && dispatch.driver.userId !== actorUserId) {
    throw new AppError("Forbidden: You are not the driver assigned to this dispatch", 403);
  }

  const tick: TelemetryTick = {
    dispatchId,
    lat: data.lat,
    lng: data.lng,
    heading: data.heading,
    speedKmh: data.speedKmh,
    stage: data.stage || dispatch.status,
    updatedAt: new Date().toISOString(),
  };

  await telemetryStore.setTelemetry(tick);
  return tick;
};

export const getLatestLocation = async (dispatchId: string) => {
  return telemetryStore.getLatestTelemetry(dispatchId);
};

export const updateDispatchStatus = async (
  id: string,
  data: UpdateDispatchStatusInput,
  actorId: string,
) => {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: { driver: true },
  });
  if (!dispatch) throw new AppError("Dispatch not found", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dispatch.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.hospitalId && { hospitalId: data.hospitalId }),
        ...(data.status === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    await tx.tripStatusLog.create({
      data: {
        dispatchId: id,
        status: data.status,
        note: data.note,
        updatedByUserId: actorId,
      },
    });

    // If reaching hospital arrival or completion, ensure payment record exists with calculated fare
    if (data.status === "HOSPITAL_ARRIVAL" || data.status === "COMPLETED") {
      const existingPayment = await tx.payment.findUnique({
        where: { requestId: dispatch.requestId },
      });
      if (!existingPayment) {
        const fullDispatch = await tx.dispatch.findUnique({
          where: { id },
          include: { ambulance: true, hospital: true, request: true },
        });
        if (fullDispatch?.request) {
          const fare = calculateTripFare({
            ambulanceType: fullDispatch.ambulance?.type ?? "BASIC",
            priority: fullDispatch.request.priority,
            pickupLat: fullDispatch.request.pickupLat,
            pickupLng: fullDispatch.request.pickupLng,
            hospitalLat: fullDispatch.hospital?.lat,
            hospitalLng: fullDispatch.hospital?.lng,
          });
          await tx.payment.create({
            data: {
              requestId: dispatch.requestId,
              amount: fare.totalFare,
              currency: "BDT",
              gateway: "SSLCOMMERZ",
              status: "PENDING",
            },
          });
        }
      }
    }

    if (data.status === "COMPLETED") {
      await tx.ambulance.update({
        where: { id: dispatch.ambulanceId },
        data: { status: "AVAILABLE" },
      });
      await tx.driver.update({
        where: { id: dispatch.driverId },
        data: { isAvailable: true },
      });
      await tx.emergencyRequest.update({
        where: { id: dispatch.requestId },
        data: { status: "COMPLETED" },
      });

      // Clear cached telemetry on mission completion
      telemetryStore.clear(id);
    } else {
      // Update stage in latest cached telemetry if available
      const existing = await telemetryStore.getLatestTelemetry(id);
      if (existing) {
        await telemetryStore.setTelemetry({
          ...existing,
          stage: data.status,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return updated;
  });
};

export const listDispatches = async (req: Request) => {
  const { limit, skip, search } = getPagination(req);
  const { status } = req.query as { status?: string };

  let driverIdFilter: string | undefined;
  if (req.user?.role === "DRIVER") {
    const driver = await prisma.driver.findFirst({
      where: { userId: req.user.userId, deletedAt: null },
    });
    if (!driver) {
      throw new AppError("Driver profile not found", 404);
    }
    driverIdFilter = driver.id;
  }

  const where: Record<string, unknown> = {
    ...(status && { status: status as never }),
    ...(driverIdFilter && { driverId: driverIdFilter }),
  };

  if (search) {
    where.OR = [
      {
        ambulance: { vehicleNumber: { contains: search, mode: "insensitive" } },
      },
      { driver: { licenseNumber: { contains: search, mode: "insensitive" } } },
      { driver: { user: { name: { contains: search, mode: "insensitive" } } } },
      {
        driver: { user: { email: { contains: search, mode: "insensitive" } } },
      },
      { request: { pickupAddress: { contains: search, mode: "insensitive" } } },
      { hospital: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, dispatches] = await Promise.all([
    prisma.dispatch.count({ where }),
    prisma.dispatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { dispatchedAt: "desc" },
      include: {
        ambulance: {
          select: {
            id: true,
            vehicleNumber: true,
            type: true,
            status: true,
          },
        },
        driver: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        request: {
          select: {
            id: true,
            pickupAddress: true,
            priority: true,
            status: true,
            payment: {
              select: {
                id: true,
                amount: true,
                currency: true,
                gateway: true,
                status: true,
                gatewayTxnId: true,
              },
            },
          },
        },
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    }),
  ]);

  return createPaginatedResponse(req, dispatches, total, "dispatches");
};

export const getMyActiveDispatch = async (userId: string) => {
  const driver = await prisma.driver.findFirst({
    where: { userId, deletedAt: null },
  });

  if (!driver) {
    throw new AppError("Driver profile not found", 404);
  }

  const dispatch = await prisma.dispatch.findFirst({
    where: {
      driverId: driver.id,
      status: { not: "COMPLETED" },
    },
    orderBy: { dispatchedAt: "desc" },
    include: {
      ambulance: {
        select: {
          id: true,
          vehicleNumber: true,
          type: true,
          status: true,
        },
      },
      request: {
        select: {
          id: true,
          pickupAddress: true,
          pickupLat: true,
          pickupLng: true,
          priority: true,
          status: true,
          description: true,
          payment: {
            select: {
              id: true,
              amount: true,
              currency: true,
              gateway: true,
              status: true,
              gatewayTxnId: true,
            },
          },
          caller: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      },
      hospital: true,
      tripStatusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return dispatch;
};
