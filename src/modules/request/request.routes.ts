import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { logAudit } from "../../utils/auditLogger";
import { sendSuccess } from "../../utils/response";
import * as requestService from "./request.service";
import { createRequestSchema, listRequestSchema } from "./request.validator";

const router = Router();

// GET /api/v1/requests/my — Patient's own requests
router.get(
  "/my",
  authenticate,
  authorize("PATIENT"),
  validate(listRequestSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const result = await requestService.getMyRequests(req.user.userId, req);
    sendSuccess(res, "Your requests fetched successfully", result);
  }),
);

// GET /api/v1/requests — ADMIN can see all
router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(listRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await requestService.listRequests(req);
    sendSuccess(res, "Requests fetched successfully", result);
  }),
);

// GET /api/v1/requests/:id — ALL authenticated users
router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const request = await requestService.getRequestById(req.params.id);
    sendSuccess(res, "Request fetched successfully", request);
  }),
);

// POST /api/v1/requests — Patient creates request
router.post(
  "/",
  authenticate,
  authorize("PATIENT"),
  validate(createRequestSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const request = await requestService.createRequest(
      req.user.userId,
      req.body,
    );
    await logAudit(req.user.userId, "CREATE", "EmergencyRequest", request.id);
    sendSuccess(res, "Emergency request created successfully", request, 201);
  }),
);

// PATCH /api/v1/requests/:id/cancel — Patient or ADMIN
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("PATIENT", "ADMIN"),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId || !req.user?.role)
      throw new AppError("Unauthorized", 401);
    const request = await requestService.cancelRequest(
      req.params.id,
      req.user.userId,
      req.user.role,
    );
    await logAudit(
      req.user.userId,
      "CANCEL",
      "EmergencyRequest",
      req.params.id,
    );
    sendSuccess(res, "Request cancelled successfully", request);
  }),
);

export default router;
