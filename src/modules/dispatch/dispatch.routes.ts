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
  recordLocationSchema,
  updateDispatchStatusSchema,
} from "./dispatch.validator";
import { telemetryStore } from "./telemetry.store";

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

// GET /api/v1/dispatches/by-request/:requestId — PATIENT, DRIVER, or ADMIN gets dispatch for a request
router.get(
  "/by-request/:requestId",
  authenticate,
  authorize("PATIENT", "DRIVER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const dispatch = await dispatchService.getDispatchByRequestId(
      req.params.requestId,
      req.user?.userId,
      req.user?.role,
    );
    sendSuccess(res, "Dispatch details fetched successfully", dispatch);
  }),
);

// POST /api/v1/dispatches/:id/location — DRIVER or ADMIN broadcasts coordinates
router.post(
  "/:id/location",
  authenticate,
  authorize("DRIVER", "ADMIN"),
  validate(recordLocationSchema),
  asyncHandler(async (req, res) => {
    if (!req.user?.userId || !req.user?.role)
      throw new AppError("Unauthorized", 401);
    const tick = await dispatchService.recordLocation(
      req.params.id,
      req.body,
      req.user.userId,
      req.user.role,
    );
    sendSuccess(res, "Location broadcast successfully", tick);
  }),
);

// GET /api/v1/dispatches/:id/telemetry/latest — Fallback coordinate polling
router.get(
  "/:id/telemetry/latest",
  authenticate,
  authorize("PATIENT", "DRIVER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const tick = await dispatchService.getLatestLocation(req.params.id);
    sendSuccess(res, "Latest telemetry fetched successfully", tick);
  }),
);

// GET /api/v1/dispatches/:id/telemetry/stream — SSE coordinate stream
router.get(
  "/:id/telemetry/stream",
  authenticate,
  authorize("PATIENT", "DRIVER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const dispatchId = req.params.id;
    // Verify dispatch exists & user has permissions
    const dispatch = await dispatchService.getDispatchById(
      dispatchId,
      req.user?.userId,
      req.user?.role,
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Initial connection ack
    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        dispatchId,
        status: dispatch.status,
      })}\n\n`,
    );

    // If there is existing cached telemetry, send immediately
    if (dispatch.latestTelemetry) {
      res.write(
        `data: ${JSON.stringify({
          type: "telemetry",
          ...dispatch.latestTelemetry,
        })}\n\n`,
      );
    }

    // Subscribe to ongoing coordinate ticks
    const unsubscribe = telemetryStore.subscribeTelemetry(
      dispatchId,
      (tick) => {
        res.write(
          `data: ${JSON.stringify({
            type: "telemetry",
            ...tick,
          })}\n\n`,
        );
      },
    );

    // 15-second heartbeat ping to prevent proxy connection timeout
    const keepAliveTimer = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(keepAliveTimer);
      unsubscribe();
      res.end();
    });
  }),
);

// GET /api/v1/dispatches/:id — ADMIN, DRIVER, or PATIENT
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "DRIVER", "PATIENT"),
  asyncHandler(async (req, res) => {
    const dispatch = await dispatchService.getDispatchById(
      req.params.id,
      req.user?.userId,
      req.user?.role,
    );
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
