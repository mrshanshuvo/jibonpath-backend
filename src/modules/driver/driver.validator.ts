import { z } from "zod";

export const createDriverSchema = z.object({
  body: z.object({
    userId: z.string().uuid("Must be a valid user ID"),
    licenseNumber: z.string().min(1, "License number is required"),
    ambulanceId: z.string().uuid().optional(),
  }),
});

export const updateDriverSchema = z.object({
  body: z.object({
    licenseNumber: z.string().optional(),
    ambulanceId: z.string().uuid().nullable().optional(),
    isAvailable: z.boolean().optional(),
  }),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>["body"];
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>["body"];

export const listDriversSchema = z.object({
  query: z.object({
    isAvailable: z.string().optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
