import { z } from "zod";

export const emailSchema = z.string().trim().min(5, "Enter a valid email").max(254, "Email is too long").email("Enter a valid email");
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");
export const nameSchema = z.string().trim().min(1, "Name is required").max(80, "Name is too long").regex(/^[\p{L}\p{N} .'_-]+$/u, "Name has invalid characters");
export const referralCodeSchema = z.string().trim().min(4).max(20).regex(/^[A-Za-z0-9]+$/, "Invalid referral code");
export const utrSchema = z.string().trim().min(6, "Enter a valid UTR / transaction reference").max(80, "Reference is too long").regex(/^[A-Za-z0-9-]+$/, "Reference may only contain letters, numbers and dashes");
export const amountSchema = z.number().finite("Enter a valid amount").positive("Enter a valid amount").max(1_000_000, "Amount is too large");

/* ------------------------------- webhooks -------------------------------- */

export const upiWebhookSchema = z.object({
  token: z.string().min(16).max(200).optional(),
  text: z.string().max(2000).optional(),
  message: z.string().max(2000).optional(),
  amount: z.union([z.number(), z.string().max(20)]).optional(),
  utr: z.string().max(80).optional(),
});
