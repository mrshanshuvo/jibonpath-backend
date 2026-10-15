import { z } from "zod";

export const createCheckoutSchema = z.object({
  body: z.object({
    requestId: z.string().uuid("Must be a valid request ID"),
    amount: z
      .number()
      .positive("Amount must be positive")
      .min(10, "Minimum amount is 10 BDT")
      .optional(),
    currency: z.string().default("bdt"),
  }),
});

export const createBkashCheckoutSchema = z.object({
  body: z.object({
    requestId: z.string().uuid("Must be a valid request ID"),
    amount: z
      .number()
      .positive("Amount must be positive")
      .min(10, "Minimum amount is 10 BDT")
      .optional(),
    payerReference: z.string().optional(),
  }),
});

export const executeBkashSchema = z.object({
  body: z.object({
    paymentID: z.string().min(1, "bKash paymentID is required"),
    requestId: z.string().uuid("Must be a valid request ID"),
  }),
});

export const initSSLCommerzSchema = z.object({
  body: z.object({
    requestId: z.string().uuid("Must be a valid request ID"),
    amount: z
      .number()
      .positive("Amount must be positive")
      .min(10, "Minimum amount is 10 BDT")
      .optional(),
  }),
});

export const getFareSchema = z.object({
  params: z.object({
    requestId: z.string().uuid("Must be a valid request ID"),
  }),
});

export const listPaymentsQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
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

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>["body"];
export type CreateBkashCheckoutInput = z.infer<
  typeof createBkashCheckoutSchema
>["body"];
export type ExecuteBkashInput = z.infer<typeof executeBkashSchema>["body"];
export type InitSSLCommerzInput = z.infer<typeof initSSLCommerzSchema>["body"];
export type ListPaymentsQueryInput = z.infer<
  typeof listPaymentsQuerySchema
>["query"];
