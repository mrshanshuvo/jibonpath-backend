import type { Request } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { createPaginatedResponse, getPagination } from "../../utils/pagination";
import type {
  CreateHospitalInput,
  UpdateHospitalInput,
} from "./hospital.validator";

export const createHospital = async (data: CreateHospitalInput) => {
  return prisma.hospital.create({ data });
};

export const listHospitals = async (req: Request) => {
  const { limit, skip, search } = getPagination(req);
  const { name } = req.query as { name?: string };

  const queryTerm =
    search || (typeof name === "string" ? name.trim() : undefined);

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (queryTerm) {
    where.OR = [
      { name: { contains: queryTerm, mode: "insensitive" } },
      { address: { contains: queryTerm, mode: "insensitive" } },
      { phone: { contains: queryTerm, mode: "insensitive" } },
    ];
  }

  const [hospitals, total] = await Promise.all([
    prisma.hospital.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.hospital.count({ where }),
  ]);

  return createPaginatedResponse(req, hospitals, total, "hospitals");
};

export const getHospitalById = async (id: string) => {
  const hospital = await prisma.hospital.findFirst({
    where: { id, deletedAt: null },
  });
  if (!hospital) throw new AppError("Hospital not found", 404);
  return hospital;
};

export const updateHospital = async (id: string, data: UpdateHospitalInput) => {
  await getHospitalById(id);
  return prisma.hospital.update({ where: { id }, data });
};

export const softDeleteHospital = async (id: string) => {
  await getHospitalById(id);
  return prisma.hospital.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
