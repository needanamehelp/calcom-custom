import crypto from "crypto";
import { z } from "zod";

import { router } from "@calcom/trpc/server/trpc";
import authedProcedure from "@calcom/trpc/server/procedures/authedProcedure";
import prisma from "@calcom/prisma";

import { razorpayCredentialKeysSchema, razorpayAppKeysSchema } from "./zod";

// Helper function to get Razorpay keys securely
async function getRazorpayKeys(userId: number) {
  const credential = await prisma.credential.findFirst({
    where: {
      userId: userId,
      type: "razorpay_payment",
    },
    select: {
      key: true,
    }
  });

  if (!credential) {
    throw new Error("Razorpay credentials not found for user.");
  }
  const parsedKeys = razorpayCredentialKeysSchema.safeParse(credential.key);
  if (!parsedKeys.success || !parsedKeys.data.key_id || !parsedKeys.data.key_secret) {
    throw new Error("Invalid Razorpay credentials format.");
  }
  return { key_id: parsedKeys.data.key_id, key_secret: parsedKeys.data.key_secret };
}

export default router({
  appKeys: authedProcedure.query(async ({ ctx }) => {
    const userId = typeof ctx.user.id === 'string' ? parseInt(ctx.user.id) : ctx.user.id;
    if (isNaN(userId)) {
        throw new Error("Invalid user ID format.");
    }
    const credentials = await prisma.credential.findMany({
      where: {
        userId: userId,
        type: "razorpay_payment",
      },
      select: {
        id: true,
        key: true,
        userId: true,
        appId: true,
      },
    });

    // Assuming only one credential per user for this app type
    const mainCredential = credentials[0];
    const keyObject = mainCredential ? razorpayCredentialKeysSchema.safeParse(mainCredential.key) : null;

    return {
      installed: !!mainCredential,
      credentials: credentials.map((cred) => ({
        id: cred.id,
        userId: cred.userId,
        appId: cred.appId,
        // Add other relevant, non-sensitive fields if needed
      })),
      otherData: keyObject?.success ? keyObject.data : {
        key_id: "",
        key_secret: "",
      },
    };
  }),

  saveKeys: authedProcedure
    .input(razorpayAppKeysSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = typeof ctx.user.id === 'string' ? parseInt(ctx.user.id) : ctx.user.id;
      if (isNaN(userId)) {
        throw new Error("Invalid user ID format.");
      }

      // Update or create credentials
      try {
        // Find any existing credentials for this user and type
        const existingCredential = await prisma.credential.findFirst({
          where: {
            userId: userId,
            type: "razorpay_payment"
          },
          select: { id: true }
        });
        
        const credential = await prisma.credential.upsert({
          where: {
            id: existingCredential?.id ?? 0, // Use 0 as a fallback ID (won't match) if no credential exists
          },
          update: {
            key: {
              key_id: input.key_id,
              key_secret: input.key_secret,
              webhook_secret: input.webhook_secret
            }
          },
          create: {
            userId: userId,
            type: "razorpay_payment",
            key: {
              key_id: input.key_id,
              key_secret: input.key_secret,
              webhook_secret: input.webhook_secret
            }
          }
        });

        return { success: true, credentialId: credential.id };
      } catch (error) {
        console.error("Error saving Razorpay credentials:", error);
        throw new Error("Failed to save Razorpay credentials");
      }
    }),

  createRazorpayOrder: authedProcedure
    .input(z.object({
      amount: z.number(), // Amount in smallest currency unit (e.g., paise for INR)
      currency: z.string().default("INR"),
      receipt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = typeof ctx.user.id === 'string' ? parseInt(ctx.user.id) : ctx.user.id;
      if (isNaN(userId)) {
        throw new Error("Invalid user ID format.");
      }
      const { key_id, key_secret } = await getRazorpayKeys(userId);

      // Use require for instantiation
      const Razorpay = require("razorpay");
      const instance = new Razorpay({
        key_id: key_id,
        key_secret: key_secret,
      });

      const options = {
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt || `receipt_order_${Date.now()}`,
      };

      try {
        const order = await instance.orders.create(options);
        if (!order) throw new Error("Order creation failed");
        return order; // Contains order_id, amount, currency, etc.
      } catch (error: any) {
        console.error("Razorpay order creation error:", error);
        throw new Error("Razorpay order creation failed: " + (error.message || error.toString()));
      }
    }),

  verifyRazorpayPayment: authedProcedure
    .input(z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
       const userId = typeof ctx.user.id === 'string' ? parseInt(ctx.user.id) : ctx.user.id;
       if (isNaN(userId)) {
        throw new Error("Invalid user ID format.");
      }
      const { key_secret } = await getRazorpayKeys(userId);

      const body = input.razorpay_order_id + "|" + input.razorpay_payment_id;

      const expectedSignature = crypto
        .createHmac("sha256", key_secret)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === input.razorpay_signature;

      if (isAuthentic) {
        // Payment is authentic, you can now process the order (e.g., save payment details to DB)
        console.log("Payment verified successfully for order:", input.razorpay_order_id);
        // Example: Update your database order status here
        // await prisma.yourOrderModel.update({ where: { id: ... }, data: { paymentStatus: 'paid' } });
        return { status: "success", orderId: input.razorpay_order_id, paymentId: input.razorpay_payment_id };
      } else {
        console.error("Payment verification failed for order:", input.razorpay_order_id);
        throw new Error("Invalid payment signature");
      }
    }),
}); 