import type { AppDeclarativeHandler } from "@calcom/types/AppHandler";
import prisma from "@calcom/prisma";
import { HttpError } from "@calcom/lib/http-error";

import appConfig from "../config.json";

// Custom handler type that supports both 'add' and 'update' operations
interface QRCodePaymentHandler extends Omit<AppDeclarativeHandler, 'handlerType'> {
  handlerType: "add" | "update";
  updateCredential?: typeof updateCredentialFn;
}

// Define the update function first for proper typing
async function updateCredentialFn({ key, credentialId, user }: { key: Record<string, unknown>; credentialId: number; user: { id: number } }) {
    if (!user?.id) {
      throw new HttpError({ statusCode: 401, message: "Unauthorized" });
    }
    
    // Check if the credential exists and belongs to the user
    const existingCredential = await prisma.credential.findFirst({
      where: {
        id: credentialId,
        userId: user.id,
      },
    });

    if (!existingCredential) {
      throw new HttpError({ statusCode: 404, message: "Credential not found" });
    }

    // Update the credential with the new key data
    return await prisma.credential.update({
      where: {
        id: credentialId,
      },
      data: {
        key,
      },
    });
}

// Create a handler that follows Cal.com's expected AppDeclarativeHandler structure
// Use a type assertion to add our additional updateCredential property that Cal.com will use at runtime
const handler = {
  appType: "qrcodepay_payment",
  variant: appConfig.variant,
  slug: appConfig.slug,
  supportsMultipleInstalls: false,
  handlerType: "add" as const, // Must be exactly 'add' to match AppDeclarativeHandler
  // Create a new credential with properly typed parameters
  createCredential: async ({ user, appType, slug, teamId }: { 
    user: { id: number };
    appType: string;
    slug: string;
    teamId?: number;
  }) => {
    return await prisma.credential.create({
      data: {
        type: appConfig.type,
        key: {},
        userId: user.id,
        appId: appConfig.slug,
      },
    });
  },
} as unknown as AppDeclarativeHandler & { updateCredential: typeof updateCredentialFn };

// Assign the update function to the handler after type assertion
(handler as any).updateCredential = updateCredentialFn;

export default handler;
