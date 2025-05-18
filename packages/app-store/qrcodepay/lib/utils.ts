import { prisma } from "@calcom/prisma";
import type { User } from "@prisma/client";

export async function isSetupComplete(userId: number): Promise<boolean> {
  const credentials = await prisma.credential.findFirst({
    where: {
      userId,
      type: "qrcodepay_payment",
    },
  });

  return !!credentials;
}

export const checkUserCredentials = async (userId: number) => {
  const credentials = await prisma.credential.findFirst({
    where: {
      userId,
      type: "qrcodepay_payment",
    },
    select: {
      key: true,
    },
  });

  if (!credentials) {
    return null;
  }

  return credentials.key as {
    qrCodeUrl: string;
    accountName: string;
    instructions?: string;
    defaultCurrency: string;
  };
};

export const getUserCredentials = async (userId: number) => {
  return checkUserCredentials(userId);
};
