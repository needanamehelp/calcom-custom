import { z } from "zod";
import crypto from "crypto";

import { router } from "@calcom/trpc/server/trpc";
import  authedProcedure  from "@calcom/trpc/server/procedures/authedProcedure";
import prisma from "@calcom/prisma";

// Define the schema directly if the import can't be found
const razorpayCredentialKeysSchema = z.object({
  key_id: z.string().optional(),
  key_secret: z.string().optional()
});

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
  appKeys: authedProcedure.query(async ({ ctx }: { ctx: { user: { id: string | number } } }) => {
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
        throw new Error(error.message || "Failed to create Razorpay order");
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