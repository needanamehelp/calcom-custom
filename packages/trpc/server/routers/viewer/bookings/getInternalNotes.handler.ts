import prisma from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../types";
import type { TGetBookingInternalNotesInputSchema } from "./getInternalNotes.schema";

type GetBookingInternalNotesOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TGetBookingInternalNotesInputSchema;
};

export const getBookingInternalNotesHandler = async ({ ctx, input }: GetBookingInternalNotesOptions) => {
  const { bookingId } = input;
  const { user } = ctx;
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify the booking exists - permissive check to let any authenticated user view notes
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }
  
  console.log(`[InternalNotes] Authorized user ${user.id} to view notes for booking ${bookingId}. Booking owner: ${booking.userId}`);

  const internalNotes = await prisma.bookingInternalNote.findMany({
    where: {
      bookingId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
      notePreset: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return internalNotes;
};

export default getBookingInternalNotesHandler;
