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

  // Strict authorization - only the booking owner can view internal notes
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
  
  // Only allow the booking owner to view internal notes
  if (booking.userId !== user.id) {
    console.log(`[InternalNotes] UNAUTHORIZED: User ${user.id} attempted to view notes for booking ${bookingId} owned by ${booking.userId}`);
    throw new Error("You do not have permission to view internal notes for this booking");
  }
  
  console.log(`[InternalNotes] Authorized user ${user.id} to view notes for their booking ${bookingId}`);


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
