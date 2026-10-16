import { z } from "zod";

export const createDispatchSchema = z.object({
  body: z.object({
    requestId: z.string().uuid("Invalid request ID"),
    ambulanceId: z.string().uuid("Invalid ambulance ID"),
    driverId: z.string().uuid("Invalid driver ID"),
    hospitalId: z.string().uuid().optional(),
  }),
});

export const updateDispatchStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "DISPATCHED",
      "EN_ROUTE",
      "PATIENT_PICKUP",
      "HOSPITAL_SELECTED",
      "HOSPITAL_ARRIVAL",
      "COMPLETED",
    ]),
    note: z.string().optional(),
    hospitalId: z.string().uuid().optional(),
  }),
});

export const listDispatchesQuerySchema = z.object({
  query: z
    .object({
      status: z
        .enum([
          "DISPATCHED",
          "EN_ROUTE",
          "PATIENT_PICKUP",
          "HOSPITAL_SELECTED",
          "HOSPITAL_ARRIVAL",
          "COMPLETED",
        ])
        .optional(),
      search: z.string().optional(),
      q: z.string().optional(),
      page: z
        .string()
        .regex(/^\d+$/, "Page must be a positive number")
        .optional(),
      limit: z
        .string()
        .regex(/^\d+$/, "Limit must be a positive number")
        .optional(),
    })
    .optional(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>["body"];
export type UpdateDispatchStatusInput = z.infer<
  typeof updateDispatchStatusSchema
>["body"];
export type ListDispatchesQueryInput = z.infer<
  typeof listDispatchesQuerySchema
>["query"];
