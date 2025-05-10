import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

import prisma from "@calcom/prisma";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import { HttpError } from "@calcom/lib/http-error";
import { defaultResponder } from "@calcom/lib/server";
import { WEBAPP_URL } from "@calcom/lib/constants";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.query;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.redirect(`${WEBAPP_URL}/booking?error=payment`);
  }

  try {
    // Find the payment by the order ID
    const payment = await prisma.payment.findFirst({
      where: {
        externalId: razorpay_order_id as string,
      },
      select: {
        id: true,
        data: true,
        bookingId: true,
        success: true,
        uid: true,
      },
    });

    if (!payment) {
      return res.redirect(`${WEBAPP_URL}/booking?error=payment`);
    }

    if (payment.success) {
      // Payment already processed, just redirect to success page
      return res.redirect(`${WEBAPP_URL}/booking/${payment.uid}`);
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
      return res.redirect(`${WEBAPP_URL}/booking?error=payment`);
    }

    const key = credential.key as Record<string, string>;
    const secret = key.key_secret;

    // Verify signature
    const hmac = crypto.createHmac("sha256", secret);
    const generatedSignature = hmac
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.redirect(`${WEBAPP_URL}/booking?error=payment`);
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

    return res.redirect(`${WEBAPP_URL}/booking/${payment.uid}`);
  } catch (e) {
    console.error(e);
    return res.redirect(`${WEBAPP_URL}/booking?error=payment`);
  }
}

export default defaultResponder(handler); 