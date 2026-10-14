import { z } from "zod";

export const createRequestSchema = z.object({
  body: z.object({
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
    pickupAddress: z.string().min(5, "Pickup address is required"),
    pickupLat: z.number().optional(),
    pickupLng: z.number().optional(),
    contactPhone: z.string().optional(),
    hospitalName: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const listRequestSchema = z.object({
  query: z.object({
    status: z
      .enum(["PENDING", "DISPATCHED", "CANCELLED", "COMPLETED"])
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>["body"];
