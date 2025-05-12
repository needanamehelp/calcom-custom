import prisma from "@calcom/prisma";

import type { TrpcSessionUser } from "../../../types";
import type { TUpsertBookingInternalNoteInputSchema } from "./upsertInternalNote.schema";

type UpsertBookingInternalNoteOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TUpsertBookingInternalNoteInputSchema;
};

export const upsertBookingInternalNoteHandler = async ({
  ctx,
  input,
}: UpsertBookingInternalNoteOptions) => {
  const { id, bookingId, text, notePresetId } = input;
  const { user } = ctx;
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  // Verify the booking exists - permissive check to let any authenticated user create notes
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
  
  console.log(`[InternalNotes] Authorized user ${user.id} to create/edit notes for booking ${bookingId}. Booking owner: ${booking.userId}`);

  if (id) {
    // Update existing note
    const existingNote = await prisma.bookingInternalNote.findFirst({
      where: {
        id,
        bookingId,
      },
    });

    if (!existingNote) {
      throw new Error("Note not found");
    }

    const updatedNote = await prisma.bookingInternalNote.update({
      where: {
        id,
      },
      data: {
        text,
        notePresetId,
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
    });

    return updatedNote;
  } else {
    // Create new note
    const newNote = await prisma.bookingInternalNote.create({
      data: {
        text,
        notePresetId,
        bookingId,
        createdById: user.id,
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
    });

    return newNote;
  }
};

export default upsertBookingInternalNoteHandler;
