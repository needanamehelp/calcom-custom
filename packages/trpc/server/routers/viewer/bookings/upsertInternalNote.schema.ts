import { z } from "zod";

export const ZUpsertBookingInternalNoteInputSchema = z.object({
  id: z.number().optional(), // ID is optional for new notes
  bookingId: z.number(),
  text: z.string().min(1, "Note text is required"),
  notePresetId: z.number().optional(), // Optional reference to a preset
});

export type TUpsertBookingInternalNoteInputSchema = z.infer<typeof ZUpsertBookingInternalNoteInputSchema>;
