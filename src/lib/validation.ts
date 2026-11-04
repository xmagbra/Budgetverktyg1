import { z } from "zod";

export const householdNameSchema = z
  .string()
  .trim()
  .min(2, "Namnet måste innehålla minst två tecken.")
  .max(100, "Namnet får vara högst 100 tecken.");

export const emailSchema = z.string().trim().email().max(254);

export const invitationSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
});

export const passwordSchema = z
  .string()
  .min(12, "Lösenordet måste innehålla minst 12 tecken.")
  .max(128, "Lösenordet får vara högst 128 tecken.");

export const uuidSchema = z.uuid();

export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);
