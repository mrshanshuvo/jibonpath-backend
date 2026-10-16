import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { logAudit } from "../../utils/auditLogger";
import { sendSuccess } from "../../utils/response";
import * as dispatchService from "./dispatch.service";
import {
  createDispatchSchema,
  listDispatchesQuerySchema,
  updateDispatchStatusSchema,
} from "./dispatch.validator";

const router = Router();

// POST /api/v1/dispatches — ADMIN dispatches an ambulance
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createDispatchSchema),
  asyncHandler(async (req, res) => {
    const dispatch = await dispatchService.createDispatch(req.body);
    await logAudit(
      req.user?.userId,
      "DISPATCH",
      "Dispatch",
      dispatch.id,
      req.body,
    );
    sendSuccess(res, "Ambulance dispatched successfully", dispatch, 201);
  }),
);

// GET /api/v1/dispatches — ADMIN or DRIVER lists dispatches with pagination & status filter
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "DRIVER"),
  validate(listDispatchesQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await dispatchService.listDispatches(req);
    sendSuccess(res, "Dispatches fetched successfully", result);
  }),
);

// GET /api/v1/dispatches/my-active — DRIVER gets their ongoing assigned dispatch
router.get(
  "/my-active",
  authenticate,
  authorize("DRIVER"),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const dispatch = await dispatchService.getMyActiveDispatch(req.user.userId);
    sendSuccess(
      res,
      dispatch
        ? "Active dispatch fetched successfully"
        : "No active dispatch found",
      dispatch,
    );
  }),
);

// GET /api/v1/dispatches/:id — ADMIN or DRIVER
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "DRIVER"),
  asyncHandler(async (req, res) => {
    const dispatch = await dispatchService.getDispatchById(req.params.id);
    sendSuccess(res, "Dispatch details fetched successfully", dispatch);
  }),
);

// PATCH /api/v1/dispatches/:id/status — DRIVER or ADMIN updates status
router.patch(
  "/:id/status",
  authenticate,
  authorize("DRIVER", "ADMIN"),
  validate(updateDispatchStatusSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId) throw new AppError("Unauthorized", 401);
    const dispatch = await dispatchService.updateDispatchStatus(
      req.params.id,
      req.body,
      req.user.userId,
    );
    await logAudit(
      req.user.userId,
      "STATUS_UPDATE",
      "Dispatch",
      dispatch.id,
      req.body,
    );
    sendSuccess(res, "Dispatch status updated successfully", dispatch);
  }),
);

export default router;
