import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { logAudit } from "../../utils/auditLogger";
import { sendSuccess } from "../../utils/response";
import * as driverService from "./driver.service";
import {
  createDriverSchema,
  listDriversSchema,
  updateDriverSchema,
} from "./driver.validator";

const router = Router();

// GET /api/v1/drivers/me — Authenticated Driver only
router.get(
  "/me",
  authenticate,
  authorize("DRIVER"),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const driver = await driverService.getMyDriverProfile(req.user.userId);
    sendSuccess(res, "Driver profile fetched", driver);
  }),
);

// GET /api/v1/drivers — ADMIN only
router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(listDriversSchema),
  asyncHandler(async (req, res) => {
    const result = await driverService.listDrivers(req);
    sendSuccess(res, "Drivers fetched successfully", result);
  }),
);

// GET /api/v1/drivers/:id — ADMIN only
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    const driver = await driverService.getDriverById(req.params.id);
    sendSuccess(res, "Driver fetched successfully", driver);
  }),
);

// POST /api/v1/drivers — ADMIN only
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createDriverSchema),
  asyncHandler(async (req, res) => {
    const driver = await driverService.createDriver(req.body);
    await logAudit(req.user?.userId, "CREATE", "Driver", driver.id);
    sendSuccess(res, "Driver registered successfully", driver, 201);
  }),
);

// PATCH /api/v1/drivers/:id — ADMIN only
router.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(updateDriverSchema),
  asyncHandler(async (req, res) => {
    const driver = await driverService.updateDriver(req.params.id, req.body);
    await logAudit(req.user?.userId, "UPDATE", "Driver", driver.id, req.body);
    sendSuccess(res, "Driver updated successfully", driver);
  }),
);

// DELETE /api/v1/drivers/:id — ADMIN only
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  asyncHandler(async (req, res) => {
    await driverService.softDeleteDriver(req.params.id);
    await logAudit(req.user?.userId, "DELETE", "Driver", req.params.id);
    sendSuccess(res, "Driver deleted successfully", null);
  }),
);

export default router;
