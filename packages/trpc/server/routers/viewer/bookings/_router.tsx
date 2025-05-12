import type { CreateInnerContextOptions } from "@calcom/trpc/server/createContext";

import authedProcedure from "../../../procedures/authedProcedure";
import publicProcedure from "../../../procedures/publicProcedure";
import { router } from "../../../trpc";
import { ZAddGuestsInputSchema } from "./addGuests.schema";
import { ZConfirmInputSchema } from "./confirm.schema";
import { ZEditLocationInputSchema } from "./editLocation.schema";
import { ZFindInputSchema } from "./find.schema";
import { ZGetInputSchema } from "./get.schema";
import { ZGetBookingAttendeesInputSchema } from "./getBookingAttendees.schema";
import { ZGetBookingInternalNotesInputSchema } from "./getInternalNotes.schema";
import { ZInstantBookingInputSchema } from "./getInstantBookingLocation.schema";
import { ZRequestRescheduleInputSchema } from "./requestReschedule.schema";
import { ZUpsertBookingInternalNoteInputSchema } from "./upsertInternalNote.schema";
import { bookingsProcedure } from "./util";

type BookingsRouterHandlerCache = {
  get?: typeof import("./get.handler").getHandler;
  requestReschedule?: typeof import("./requestReschedule.handler").requestRescheduleHandler;
  editLocation?: typeof import("./editLocation.handler").editLocationHandler;
  addGuests?: typeof import("./addGuests.handler").addGuestsHandler;
  confirm?: typeof import("./confirm.handler").confirmHandler;
  getBookingAttendees?: typeof import("./getBookingAttendees.handler").getBookingAttendeesHandler;
  find?: typeof import("./find.handler").getHandler;
  getInstantBookingLocation?: typeof import("./getInstantBookingLocation.handler").getHandler;
  getInternalNotes?: typeof import("./getInternalNotes.handler").getBookingInternalNotesHandler;
  upsertInternalNote?: typeof import("./upsertInternalNote.handler").upsertBookingInternalNoteHandler;
};

export const bookingsRouter = router({
  get: authedProcedure.input(ZGetInputSchema).query(async ({ input, ctx }) => {
    const { getHandler } = await import("./get.handler");

    return getHandler({
      ctx,
      input,
    });
  }),

  requestReschedule: authedProcedure.input(ZRequestRescheduleInputSchema).mutation(async ({ input, ctx }) => {
    const { requestRescheduleHandler } = await import("./requestReschedule.handler");

    return requestRescheduleHandler({
      ctx,
      input,
    });
  }),

  editLocation: bookingsProcedure.input(ZEditLocationInputSchema).mutation(async ({ input, ctx }) => {
    const { editLocationHandler } = await import("./editLocation.handler");

    return editLocationHandler({
      ctx,
      input,
    });
  }),

  addGuests: authedProcedure.input(ZAddGuestsInputSchema).mutation(async ({ input, ctx }) => {
    const { addGuestsHandler } = await import("./addGuests.handler");

    return addGuestsHandler({
      ctx,
      input,
    });
  }),

  confirm: authedProcedure.input(ZConfirmInputSchema).mutation(async ({ input, ctx }) => {
    const { confirmHandler } = await import("./confirm.handler");

    return confirmHandler({
      ctx,
      input,
    });
  }),

  getBookingAttendees: authedProcedure
    .input(ZGetBookingAttendeesInputSchema)
    .query(async ({ input, ctx }) => {
      const { getBookingAttendeesHandler } = await import("./getBookingAttendees.handler");

      return getBookingAttendeesHandler({
        ctx,
        input,
      });
    }),

  find: publicProcedure.input(ZFindInputSchema).query(async ({ input, ctx }) => {
    const { getHandler } = await import("./find.handler");

    return getHandler({
      ctx,
      input,
    });
  }),

  getInstantBookingLocation: publicProcedure
    .input(ZInstantBookingInputSchema)
    .query(async ({ input, ctx }) => {
      const { getHandler } = await import("./getInstantBookingLocation.handler");

      return getHandler({
        ctx,
        input,
      });
    }),
    
  getInternalNotes: authedProcedure
    .input(ZGetBookingInternalNotesInputSchema)
    .query(async ({ ctx, input }) => {
      const { getBookingInternalNotesHandler } = await import("./getInternalNotes.handler");
      return getBookingInternalNotesHandler({
        ctx: { user: ctx.user },
        input,
      });
    }),
    
  upsertInternalNote: authedProcedure
    .input(ZUpsertBookingInternalNoteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { upsertBookingInternalNoteHandler } = await import("./upsertInternalNote.handler");
      return upsertBookingInternalNoteHandler({
        ctx: { user: ctx.user },
        input
      });
    }),
});
