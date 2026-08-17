// Central strict input schemas. Reject anything that does not match — never
// silently sanitize. Used by client forms, server functions and webhooks.
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(5, "Enter a valid email")
  .max(254, "Email is too long")
  .email("Enter a valid email");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80, "Name is too long")
  .regex(/^[\p{L}\p{N} .'_-]+$/u, "Name has invalid characters");

export const referralCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(20)
  .regex(/^[A-Za-z0-9]+$/, "Invalid referral code");

export const utrSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid UTR / transaction reference")
  .max(80, "Reference is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Reference may only contain letters, numbers and dashes");

export const txHashSchema = z
  .string()
  .trim()
  .min(10, "Enter a valid transaction hash")
  .max(120, "Transaction hash is too long")
  .regex(/^[A-Za-z0-9]+$/, "Transaction hash has invalid characters");

export const amountSchema = z
  .number()
  .finite("Enter a valid amount")
  .positive("Enter a valid amount")
  .max(1_000_000, "Amount is too large");

export const noteSchema = z.string().trim().max(300, "Note is too long");

/* ------------------------------ image uploads ----------------------------- */

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB
export const MAX_QR_UPLOAD_BYTES = 1024 * 1024; // 1 MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Magic-byte signatures — content check, not just extension / declared MIME. */
const SIGNATURES: Array<{ type: string; test: (b: Uint8Array) => boolean }> = [
  { type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export function sniffImageType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((s) => s.test(bytes))?.type ?? null;
}

/**
 * Validates a user-picked file by real content, size and declared type.
 * Returns a base64 data URL only when everything matches.
 */
export async function readValidatedImage(
  file: File,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<{ ok: true; dataUrl: string; name: string; type: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "File is empty" };
  if (file.size > maxBytes) return { ok: false, error: `File must be under ${Math.round(maxBytes / 1024 / 1024)} MB` };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Only PNG, JPG or WEBP images are allowed" };
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffImageType(head);
  if (!sniffed) return { ok: false, error: "That file is not a real image" };
  if (sniffed !== file.type) return { ok: false, error: "File content does not match its type" };

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  }).catch(() => "");

  if (!dataUrl.startsWith(`data:${sniffed};base64,`)) return { ok: false, error: "Could not read that image" };
  // Stored as an inert base64 data URL in the database — never written to disk
  // and never served from a path that could execute.
  const safeName = file.name.replace(/[^\w.\- ]/g, "").slice(0, 80) || "upload";
  return { ok: true, dataUrl, name: safeName, type: sniffed };
}

/** Server-side guard for an already-encoded image data URL. */
export const imageDataUrlSchema = z
  .string()
  .max(4_500_000, "Image is too large")
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Invalid image upload");

/* ------------------------------- deposits -------------------------------- */

export const depositSubmitSchema = z
  .object({
    amount: amountSchema,
    currency: z.enum(["INR", "USDT"]),
    network: z.string().trim().max(30).optional(),
    utr: z.string().trim().min(6).max(120),
    screenshotDataUrl: imageDataUrlSchema,
    note: noteSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const ref = v.currency === "INR" ? utrSchema.safeParse(v.utr) : txHashSchema.safeParse(v.utr);
    if (!ref.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["utr"], message: ref.error.issues[0]!.message });
    }
  });

/* ------------------------------- webhooks -------------------------------- */

export const upiWebhookSchema = z.object({
  token: z.string().min(16).max(200).optional(),
  text: z.string().max(2000).optional(),
  message: z.string().max(2000).optional(),
  amount: z.union([z.number(), z.string().max(20)]).optional(),
  utr: z.string().max(80).optional(),
});
