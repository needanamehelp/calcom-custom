import type { Payment } from "@prisma/client";
import { z } from "zod";

import { handlePayment } from "./lib/handlePayment";
import { createPaymentLink } from "./lib/createPaymentLink";
import { metadata } from "./_metadata";

// Define our own payment app structure based on Cal.com's existing payment apps
interface AppPaymentHandler {
  name: string;
  title: string;
  slug: string;
  type: string;
  variant: string;
  logo: string;
  categories: string[];
  description: string;
  isGlobal?: boolean;
  metadata: any;
  createPaymentLink: typeof createPaymentLink;
  handlePayment: (payment: Payment, bookingId: number) => Promise<any>;
  schema: z.ZodSchema<any>;
  appData?: Record<string, unknown>;
}

const paymentAppSchema = z.object({
  paymentOption: z.string(),
  price: z.number(),
  currency: z.string(),
  appId: z.string().optional(),
});

export const qrCodePaymentApp: AppPaymentHandler = {
  name: "qrcodepay",
  // Cal.com expects the title in this format
  title: "QR Code Payment",
  slug: "qrcodepay",
  type: "qrcodepay_payment",
  variant: "payment",
  logo: "/api/app-store/qrcodepay/icon.svg",
  categories: ["payment"],
  description: "Accept payments through customizable QR codes",
  isGlobal: false,
  appData: {},
  metadata,
  createPaymentLink,
  handlePayment: async (payment: Payment, bookingId: number) => {
    return handlePayment(bookingId, payment.id);
  },
  schema: paymentAppSchema,
};

// Export the payment options for the index.ts file
export const paymentOptions = {
  name: "qrcodepay",
  title: "QR Code Payment",
  description: "Accept payments with QR codes for UPI, PayTM, and other local payment methods",
};

// Export the createHandler function for the index.ts file
// Use a type assertion to avoid the type error with CreatePaymentLinkOptions
export const createHandler = qrCodePaymentApp.createPaymentLink as unknown as (...args: any[]) => Promise<any>;

export default qrCodePaymentApp;
