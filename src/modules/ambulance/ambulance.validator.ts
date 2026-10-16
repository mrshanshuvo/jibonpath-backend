import { z } from "zod";

export const createAmbulanceSchema = z.object({
  body: z.object({
    vehicleNumber: z.string().min(1, "Vehicle number is required"),
    type: z.enum(["BASIC", "ADVANCED_LIFE_SUPPORT", "INTENSIVE_CARE"]),
    make: z.string().optional(),
    year: z.number().int().optional(),
  }),
});

export const updateAmbulanceSchema = z.object({
  body: z.object({
    vehicleNumber: z.string().optional(),
    type: z
      .enum(["BASIC", "ADVANCED_LIFE_SUPPORT", "INTENSIVE_CARE"])
      .optional(),
    status: z
      .enum(["AVAILABLE", "DISPATCHED", "MAINTENANCE", "RETIRED"])
      .optional(),
    make: z.string().optional(),
    year: z.number().int().optional(),
  }),
});

export const listAmbulanceSchema = z.object({
  query: z.object({
    status: z
      .enum(["AVAILABLE", "DISPATCHED", "MAINTENANCE", "RETIRED"])
      .optional(),
    type: z
      .enum(["BASIC", "ADVANCED_LIFE_SUPPORT", "INTENSIVE_CARE"])
      .optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export type CreateAmbulanceInput = z.infer<
  typeof createAmbulanceSchema
>["body"];
export type UpdateAmbulanceInput = z.infer<
  typeof updateAmbulanceSchema
>["body"];
