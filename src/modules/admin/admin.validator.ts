import { z } from "zod";

export const createAdminDriverSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Must be a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().min(10, "Phone must be at least 10 characters"),
    licenseNumber: z.string().min(1, "License number is required"),
    ambulanceId: z.string().uuid("Invalid ambulance ID").optional(),
  }),
});

export type CreateAdminDriverInput = z.infer<
  typeof createAdminDriverSchema
>["body"];

export const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(["PATIENT", "DRIVER", "ADMIN"]).optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const listAuditLogsSchema = z.object({
  query: z.object({
    action: z.string().optional(),
    entityType: z.string().optional(),
    search: z.string().optional(),
    q: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
