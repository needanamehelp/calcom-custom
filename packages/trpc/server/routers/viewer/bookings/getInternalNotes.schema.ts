import { z } from "zod";

export const ZGetBookingInternalNotesInputSchema = z.object({
  bookingId: z.number(),
});

export type TGetBookingInternalNotesInputSchema = z.infer<typeof ZGetBookingInternalNotesInputSchema>;
