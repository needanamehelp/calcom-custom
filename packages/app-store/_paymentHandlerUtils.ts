import type { Payment, Booking } from "@prisma/client";
import { metadata as qrcodepayMetadata } from "./qrcodepay/_metadata";

// Using an import type that exists in Cal.com
type PaymentLinkOptions = {
  paymentUid: string;
  bookingUid: string;
  redirectUrl: string;
  paymentAmount: number;
  currency: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
  username?: string;
  bookingId?: number;
  success?: boolean;
};

// This is a registry of payment handlers that Cal.com will use to find payment handlers
export const paymentHandlers = {
  qrcodepay_payment: {
    metadata: qrcodepayMetadata,
    createPaymentLink: async (options: PaymentLinkOptions) => {
      const { createPaymentLink } = await import("./qrcodepay/lib/createPaymentLink");
      return createPaymentLink(options);
    },
    handlePayment: async (payment: Payment, bookingId: Booking["id"]) => {
      const { handlePayment } = await import("./qrcodepay/lib/handlePayment");
      return handlePayment(bookingId, payment.id);
    },
  },
};
