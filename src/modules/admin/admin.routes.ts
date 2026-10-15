import { Router } from "express";
import { prisma } from "../../config/db";
import { redisClient } from "../../config/redis";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { logAudit } from "../../utils/auditLogger";
import { createPaginatedResponse, getPagination } from "../../utils/pagination";
import { sendSuccess } from "../../utils/response";
import * as adminService from "./admin.service";
import {
  createAdminDriverSchema,
  listAuditLogsSchema,
  listUsersSchema,
} from "./admin.validator";

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, authorize("ADMIN"));

// POST /api/v1/admin/drivers — Direct driver onboarding by Admin
router.post(
  "/drivers",
  validate(createAdminDriverSchema),
  asyncHandler(async (req, res) => {
    const result = await adminService.createDriverByAdmin(req.body);
    await logAudit(req.user?.userId, "CREATE", "Driver", result.id, {
      email: result.user.email,
      licenseNumber: result.licenseNumber,
    });
    sendSuccess(res, "Driver created successfully", result, 201);
  }),
);

// GET /api/v1/admin/users — List all users with pagination + search
router.get(
  "/users",
  validate(listUsersSchema),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, search } = getPagination(req);
    const { role } = req.query as { role?: string };

    const where = {
      deletedAt: null,
      ...(role && { role: role as never }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    sendSuccess(
      res,
      "Users fetched successfully",
      createPaginatedResponse(req, users, total, "users"),
    );
  }),
);

// PATCH /api/v1/admin/users/:id/role — Update user role
router.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!["PATIENT", "DRIVER", "ADMIN"].includes(role)) {
      throw new AppError("Invalid role", 400);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    await logAudit(req.user?.userId, "UPDATE_ROLE", "User", user.id, {
      newRole: role,
    });
    sendSuccess(res, "User role updated successfully", user);
  }),
);

// PATCH /api/v1/admin/users/:id/status — Activate/deactivate user
router.patch(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      throw new AppError("isActive must be a boolean", 400);
    }

    if (req.params.id === req.user?.userId && !isActive) {
      throw new AppError("You cannot deactivate your own account", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existingUser) {
      throw new AppError("User not found", 404);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logAudit(req.user?.userId, "UPDATE_STATUS", "User", user.id, {
      isActive,
    });

    sendSuccess(
      res,
      `User ${isActive ? "activated" : "deactivated"} successfully`,
      user,
    );
  }),
);

// DELETE /api/v1/admin/users/:id — Soft delete user
router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user?.userId) {
      throw new AppError("You cannot delete your own account", 400);
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await logAudit(req.user?.userId, "DELETE", "User", req.params.id);
    sendSuccess(res, "User deleted successfully", null);
  }),
);

// GET /api/v1/admin/audit-logs — View audit trail
router.get(
  "/audit-logs",
  validate(listAuditLogsSchema),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, search } = getPagination(req);
    const { action, entityType } = req.query as {
      action?: string;
      entityType?: string;
    };

    const where = {
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: "insensitive" as const } },
          { entityType: { contains: search, mode: "insensitive" as const } },
          { entityId: { contains: search, mode: "insensitive" as const } },
          {
            actor: { name: { contains: search, mode: "insensitive" as const } },
          },
          {
            actor: {
              email: { contains: search, mode: "insensitive" as const },
            },
          },
        ],
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendSuccess(
      res,
      "Audit logs fetched successfully",
      createPaginatedResponse(req, logs, total, "logs"),
    );
  }),
);

// GET /api/v1/admin/stats — Dashboard summary statistics
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const CACHE_KEY = "admin:stats";

    if (redisClient) {
      try {
        const cached = await redisClient.get(CACHE_KEY);
        if (cached) {
          sendSuccess(
            res,
            "Admin stats fetched successfully (cached)",
            JSON.parse(cached),
          );
          return;
        }
      } catch (err: unknown) {
        // Fallback to database on redis read failure
      }
    }

    const [
      totalUsers,
      totalDrivers,
      totalAmbulances,
      availableAmbulances,
      dispatchedAmbulances,
      totalRequests,
      pendingRequests,
      completedRequests,
      totalRevenueResult,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.driver.count({ where: { deletedAt: null } }),
      prisma.ambulance.count({ where: { deletedAt: null } }),
      prisma.ambulance.count({
        where: { deletedAt: null, status: "AVAILABLE" },
      }),
      prisma.ambulance.count({
        where: { deletedAt: null, status: "DISPATCHED" },
      }),
      prisma.emergencyRequest.count({ where: { deletedAt: null } }),
      prisma.emergencyRequest.count({
        where: { deletedAt: null, status: "PENDING" },
      }),
      prisma.emergencyRequest.count({
        where: { deletedAt: null, status: "COMPLETED" },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amount: true },
      }),
    ]);

    const stats = {
      users: {
        total: totalUsers,
        drivers: totalDrivers,
      },
      ambulances: {
        total: totalAmbulances,
        available: availableAmbulances,
        dispatched: dispatchedAmbulances,
        maintenance:
          totalAmbulances - (availableAmbulances + dispatchedAmbulances),
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        completed: completedRequests,
      },
      payments: {
        totalRevenue: totalRevenueResult._sum.amount || 0,
        currency: "BDT",
      },
    };

    if (redisClient) {
      try {
        await redisClient.set(CACHE_KEY, JSON.stringify(stats), "EX", 60);
      } catch (err: unknown) {
        // Continue even if redis set fails
      }
    }

    sendSuccess(res, "Admin stats fetched successfully", stats);
  }),
);

export default router;
