import type { Request } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { createPaginatedResponse, getPagination } from "../../utils/pagination";
import type { CreateDriverInput, UpdateDriverInput } from "./driver.validator";

export const createDriver = async (data: CreateDriverInput) => {
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new AppError("User not found", 404);

  const existing = await prisma.driver.findUnique({
    where: { userId: data.userId },
  });
  if (existing)
    throw new AppError("This user is already a registered driver", 409);

  // Update user role to DRIVER
  await prisma.user.update({
    where: { id: data.userId },
    data: { role: "DRIVER" },
  });

  return prisma.driver.create({ data });
};

export const listDrivers = async (req: Request) => {
  const { limit, skip, search } = getPagination(req);
  const isAvailable =
    req.query.isAvailable === "true"
      ? true
      : req.query.isAvailable === "false"
        ? false
        : undefined;

  const where: Record<string, unknown> = {
    deletedAt: null,
    ...(isAvailable !== undefined && { isAvailable }),
  };

  if (search) {
    where.OR = [
      { licenseNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [drivers, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        ambulance: {
          select: { vehicleNumber: true, type: true, status: true },
        },
      },
    }),
    prisma.driver.count({ where }),
  ]);

  return createPaginatedResponse(req, drivers, total, "drivers");
};

export const getDriverById = async (id: string) => {
  const driver = await prisma.driver.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { name: true, email: true, phone: true, role: true } },
      ambulance: true,
    },
  });
  if (!driver) throw new AppError("Driver not found", 404);
  return driver;
};

export const getMyDriverProfile = async (userId: string) => {
  const driver = await prisma.driver.findFirst({
    where: { userId, deletedAt: null },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      ambulance: true,
    },
  });
  if (!driver) throw new AppError("Driver profile not found", 404);
  return driver;
};

export const updateDriver = async (id: string, data: UpdateDriverInput) => {
  await getDriverById(id);
  return prisma.driver.update({ where: { id }, data });
};

export const softDeleteDriver = async (id: string) => {
  await getDriverById(id);
  return prisma.driver.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
