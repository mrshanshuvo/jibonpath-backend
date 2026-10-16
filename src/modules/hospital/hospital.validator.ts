import { z } from "zod";

export const createHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name is required"),
    address: z.string().min(5, "Address is required"),
    phone: z.string().min(6, "Phone is required"),
    lat: z.number().optional(),
    lng: z.number().optional(),
    capacity: z.number().int().positive().optional(),
  }),
});

export const updateHospitalSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    capacity: z.number().int().positive().optional(),
  }),
});

export const listHospitalSchema = z.object({
  query: z.object({
    name: z.string().optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export type CreateHospitalInput = z.infer<typeof createHospitalSchema>["body"];
export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>["body"];
