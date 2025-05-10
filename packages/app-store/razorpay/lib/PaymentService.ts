import Razorpay from "razorpay";
import {
  Booking,
  Payment as PaymentModel,
  Prisma,
  PaymentOption,
} from "@prisma/client";
import prisma from "@calcom/prisma";
import { ErrorCode } from "@calcom/lib/errorCodes";
import logger from "@calcom/lib/logger";
import { getParsedAppKeysFromSlug } from "@calcom/app-store/_utils/getParsedAppKeysFromSlug";
import { razorpayCredentialKeysSchema } from "../config/link";
import type { IAbstractPaymentService } from "@calcom/types/PaymentService";

const log = logger.getSubLogger({ prefix: ["razorpay", "PaymentService"] });

interface RazorpayInstance {
  // Add method signatures you use from Razorpay
  orders: {
    create(options: any): Promise<any>;
  };
  payments: {
    capture(paymentId: string, amount: number): Promise<any>;
    refund(paymentId: string, options: { amount?: number }): Promise<any>;
  };
}

export class PaymentService implements IAbstractPaymentService {
  private razorpay: RazorpayInstance | null = null;

  static async create(): Promise<PaymentService> {
    const creds = await getParsedAppKeysFromSlug("razorpay", razorpayCredentialKeysSchema);
    if (!creds.key_id || !creds.key_secret) {
      throw new Error("Razorpay credentials not found");
    }
    const service = new PaymentService();
    service.razorpay = new (Razorpay as unknown as new (options: {
      key_id: string;
      key_secret: string;
    }) => RazorpayInstance)({
      key_id: creds.key_id,
      key_secret: creds.key_secret,
    });
    return service;
  }

  private constructor() {}

  isSetupAlready(): boolean {
    return false; // Adjust logic as needed
  }

  async create(
    { amount, currency }: { amount: number; currency: string },
    bookingId: Booking["id"],
    userId: Booking["userId"],
    username: string | null,
    bookerName: string,
    paymentOption: PaymentOption,
    bookerEmail: string,
    bookerPhoneNumber?: string | null,
    eventTitle?: string,
    bookingTitle?: string
  ): Promise<PaymentModel> {
    if (paymentOption !== PaymentOption.ON_BOOKING) {
      throw new Error("Razorpay only supports ON_BOOKING payments");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { uid: true, eventType: { select: { slug: true } } },
    });
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    try {
      if (!this.razorpay) {
        throw new Error("Razorpay instance not initialized");
      }
      const order = await this.razorpay.orders.create({
        amount: amount * 100, // paise
        currency,
        receipt: `booking-${bookingId}`,
        payment_capture: 1,
        notes: {
          bookingId: String(bookingId),
          userId: String(userId),
          email: bookerEmail,
          phone: bookerPhoneNumber ?? "",
          eventType: booking.eventType?.slug ?? "",
          eventTitle: eventTitle ?? "",
          bookingTitle: bookingTitle ?? "",
        },
      });

      return await prisma.payment.create({
        data: {
          uid: order.id,
          app: { connect: { slug: "razorpay" } },
          booking: { connect: { id: bookingId } },
          amount,
          currency,
          externalId: order.id,
          data: order as unknown as Prisma.InputJsonValue,
          fee: 0,
          refunded: false,
          success: order.status === "created",
          paymentOption,
        },
      });
    } catch (err: any) {
      log.error("Razorpay: Payment creation failed", err);
      throw new Error(ErrorCode.PaymentCreationFailure);
    }
  }

  async capture(
    paymentId: number,
    amount?: number
  ): Promise<PaymentModel> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || !payment.externalId) {
      throw new Error("Payment not found");
    }

    try {
      if (!this.razorpay) throw new Error("Razorpay client not initialized");
      if (amount === undefined) throw new Error("Amount required for capture");
      const captured = await this.razorpay.payments.capture(
        payment.externalId,
        amount
      );
      return await prisma.payment.update({
        where: { id: paymentId },
        data: {
          success: true,
          data: {
            ...(payment.data as object),
            capture: captured,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      log.error("Razorpay: Capture failed", err);
      throw err;
    }
  }

  async refund(
    paymentId: number,
    amount?: number
  ): Promise<PaymentModel> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || !payment.externalId) {
      throw new Error("Payment not found");
    }

    try {
      if (!this.razorpay) throw new Error("Razorpay client not initialized");
      const refund = await this.razorpay.payments.refund(
        payment.externalId,
        { amount }
      );
      return await prisma.payment.update({
        where: { id: paymentId },
        data: {
          refunded: true,
          data: {
            ...(payment.data as object),
            refund,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      log.error("Razorpay: Refund failed", err);
      throw err;
    }
  }

  async update(
    paymentId: number,
    data: Partial<Prisma.PaymentUncheckedCreateInput>
  ): Promise<PaymentModel> {
    return prisma.payment.update({
      where: { id: paymentId },
      data,
    });
  }

  async collectCard(): Promise<PaymentModel> {
    throw new Error("Razorpay doesn't support card collection without payment");
  }

  async chargeCard(): Promise<PaymentModel> {
    throw new Error("Razorpay doesn't support charging saved cards");
  }

  async getPaymentPaidStatus(): Promise<string> {
    throw new Error("Not implemented");
  }

  async getPaymentDetails(): Promise<PaymentModel> {
    throw new Error("Not implemented");
  }

  async afterPayment(): Promise<void> {
    return;
  }

  async deletePayment(paymentId: number): Promise<boolean> {
    await prisma.payment.delete({ where: { id: paymentId } });
    return true;
  }
}
