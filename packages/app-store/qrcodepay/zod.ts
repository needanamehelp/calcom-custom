import { z } from "zod";

// Based on Cal.com's payment app schema pattern
export const paymentOptionEnum = z.enum(["ON_BOOKING", "HOLD", "PAY_LATER"]);

// Define the schema for the QR code payment app
export const appDataSchema = z.object({
  // Required fields for payment integration
  price: z.number().min(0).default(0),
  currency: z.enum(["INR", "USD"]).default("INR"),
  enabled: z.boolean().default(false),
  paymentOption: paymentOptionEnum.default("ON_BOOKING"),
  
  // QR code specific fields
  qrCodeUrl: z.string().url().optional().nullable(),
  instructions: z.string().optional(),
  accountName: z.string().min(1, { message: "Please enter a valid account name" }).optional(),
  upiId: z.string().optional(),
  
  // Refund related fields
  refundPolicy: z.string().optional(),
  refundDaysCount: z.number().optional(),
  refundCountCalendarDays: z.boolean().optional(),
});

// Add the required appKeysSchema for Cal.com to recognize our app's credentials
export const appKeysSchema = z.object({
  // These fields must match exactly what's sent from the setup page
  accountName: z.string().describe("Name on the payment account"),
  instructions: z.string().optional().describe("Instructions for making payment via QR code"),
  qrCodeUrl: z.string().describe("URL for the payment QR code image"),
  defaultCurrency: z.string().describe("Default currency for payments"),
});

export type AppData = z.infer<typeof appDataSchema>;
