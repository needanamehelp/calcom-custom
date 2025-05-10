import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

import prisma from "@calcom/prisma";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import { HttpError } from "@calcom/lib/http-error";
import { defaultResponder } from "@calcom/lib/server";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Get the payment details from the request body
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  } = req.body;

  try {
    // Find the payment by the order ID
    const payment = await prisma.payment.findFirst({
      where: {
        externalId: razorpay_order_id,
      },
      select: {
        id: true,
        data: true,
        bookingId: true,
        success: true,
      },
    });

    if (!payment || payment.success) {
      return res.status(400).json({ message: "Invalid payment or already processed" });
    }

    // Get the credentials from payment data
    const data = payment.data as Record<string, unknown>;
    const keyId = data.key_id as string;

    // Get the Razorpay credentials
    const credential = await prisma.credential.findFirst({
      where: {
        type: "razorpay_payment",
        key: {
          path: ["key_id"],
          equals: keyId,
        },
      },
      select: {
        key: true,
      },
    });

    if (!credential) {
      return res.status(400).json({ message: "Invalid Razorpay credentials" });
    }

    const key = credential.key as Record<string, string>;
    const secret = key.key_secret;

    // Verify signature
    const hmac = crypto.createHmac("sha256", secret);
    const generatedSignature = hmac
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    // Update payment with success
    await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        success: true,
        data: {
          ...data,
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
        },
      },
    });
    // Handle payment success logic
    await handlePaymentSuccess(payment.id, payment.bookingId);

    return res.status(200).json({ message: "Success" });
  } catch (e) {
    let message = "Unknown error";
    if (e instanceof Error) {
      message = e.message;
    }
    return res.status(500).json({ message });
  }
}

export default defaultResponder(handler); 