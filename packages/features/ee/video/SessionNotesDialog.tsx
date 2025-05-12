import { useState, useEffect } from "react";
import dayjs from "@calcom/dayjs";
import { Dialog } from "@calcom/features/components/controlled-dialog";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { DialogContent, DialogFooter, DialogClose } from "@calcom/ui/components/dialog";
import { TextAreaField, InputField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";

type BookingItem = RouterOutputs["viewer"]["bookings"]["get"]["bookings"][number];

interface ISessionNotesDialog {
  booking?: BookingItem;
  isOpenDialog: boolean;
  setIsOpenDialog: React.Dispatch<React.SetStateAction<boolean>>;
  timeFormat: number | null;
}

interface GetTimeSpanProps {
  startTime: string | undefined;
  endTime: string | undefined;
  locale: string;
  hour12: boolean;
}

const getTimeSpan = ({ startTime, endTime, locale, hour12 }: GetTimeSpanProps) => {
  if (!startTime || !endTime) return "";

  const formattedStartTime = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "numeric",
    hour12,
  }).format(new Date(startTime));

  const formattedEndTime = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "numeric",
    hour12,
  }).format(new Date(endTime));

  return `${formattedStartTime} - ${formattedEndTime}`;
};

export const SessionNotesDialog = (props: ISessionNotesDialog) => {
  const { t, i18n } = useLocale();
  const { isOpenDialog, setIsOpenDialog, booking, timeFormat } = props;
  const [notes, setNotes] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [sessionNumber, setSessionNumber] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const utils = trpc.useUtils();
  
  // Query to get existing notes
  const { data: existingNotes } = trpc.viewer.bookings.getInternalNotes.useQuery(
    { bookingId: booking?.id || 0 },
    {
      enabled: isOpenDialog && !!booking?.id
    }
  );
  
  // Query to count previous sessions with the same attendee
  const { data: previousSessions } = trpc.viewer.bookings.get.useQuery(
    { 
      filters: {
        // Use past status to get all completed meetings
        status: "past",
        // Filter by primary attendee email if available
        attendeeEmail: booking?.attendees?.[0]?.email || undefined
      },
      limit: 100,
      offset: 0
    },
    {
      enabled: isOpenDialog && !!booking?.id && !!booking?.attendees?.length,
      // This is a potentially expensive query, so let's increase staleTime
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Initialize title with booking title when dialog opens
  useEffect(() => {
    if (isOpenDialog && booking?.title) {
      setSessionTitle(booking.title);
    }
  }, [isOpenDialog, booking]);

  // Calculate session number and handle existing notes
  useEffect(() => {
    if (!isOpenDialog) return;

    // Calculate session number from previous sessions
    if (previousSessions?.bookings) {
      // Find bookings with the same attendee and count them
      // Add 1 for the current session
      const sessionCount = previousSessions.bookings.length;
      
      // Set the session number (we add 1 to the number of past bookings to get current session number)
      setSessionNumber(sessionCount + 1);
    }
    
    // Handle existing notes
    if (!existingNotes) return;
    
    // Handle case when there's no data
    if (existingNotes.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      // Find the most recent session note by sorting by createdAt date in descending order
      const sortedNotes = [...existingNotes].sort((a, b) => {
        // Safely convert dates and handle potential invalid dates
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Get the most recent note that has meaningful text content (not empty)
      const mostRecentNote = sortedNotes.find(note => note.text && note.text.trim() !== "");
      
      if (mostRecentNote && mostRecentNote.text) {
        // Extract the title if it exists in the text (for backward compatibility)
        const titlePattern = /^Title: (.*?)\n/;
        const match = mostRecentNote.text.match(titlePattern);
        
        if (match && match[1]) {
          setSessionTitle(match[1]);
          // Remove the title line from the notes
          setNotes(mostRecentNote.text.replace(titlePattern, ''));
        } else {
          setNotes(mostRecentNote.text);
        }
      }
    } catch (error) {
      console.error("Error processing notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [existingNotes, previousSessions, isOpenDialog]);
  
  // Mutation to save notes
  const upsertNoteMutation = trpc.viewer.bookings.upsertInternalNote.useMutation({
    onSuccess: () => {
      showToast("Session notes saved successfully", "success");
      utils.viewer.bookings.getInternalNotes.invalidate({ bookingId: booking?.id });
      setIsSaving(false);
      setIsOpenDialog(false);
    },
    onError: () => {
      showToast("Failed to save session notes", "error");
      setIsSaving(false);
    }
  });
  
  const handleSaveNotes = () => {
    if (!booking?.id) {
      showToast("Booking information missing", "error");
      return;
    }
    
    // Combine title and notes for storage
    // We'll format it so we can parse it later if needed
    const fullText = sessionTitle ? `Title: ${sessionTitle}\n${notes}` : notes;
    
    setIsSaving(true);
    upsertNoteMutation.mutate({
      bookingId: booking.id,
      text: fullText,
    });
  };

  const subtitle = `${booking?.title} - ${dayjs(booking?.startTime).format("ddd")} ${dayjs(
    booking?.startTime
  ).format("D")}, ${dayjs(booking?.startTime).format("MMM")} ${getTimeSpan({
    startTime: booking?.startTime,
    endTime: booking?.endTime,
    locale: i18n.language,
    hour12: timeFormat === 12,
  })} `;

  return (
    <Dialog open={isOpenDialog} onOpenChange={setIsOpenDialog}>
      <DialogContent>
        <div className="mb-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">
                Session #{sessionNumber + 1} {/* Add 1 to make it 1-indexed rather than 0-indexed */}
              </h3>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="mb-4">
            <div className="h-32 animate-pulse rounded-md bg-gray-200"></div>
            <div className="mt-2 text-sm text-gray-500">Loading existing notes...</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <InputField
                className="mb-2"
                name="sessionTitle"
                label="Session Title"
                placeholder="Enter a title for this session"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
              />
            </div>
            <div>
              <TextAreaField
                name="sessionNotes"
                label="Session Notes"
                placeholder="Add notes about this session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-32"
              />
            </div>
          </div>
        )}
        
        <DialogFooter>
          <DialogClose className="border" />
          <Button 
            type="button" 
            color="primary" 
            loading={isSaving}
            onClick={handleSaveNotes}
          >
            {"Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionNotesDialog;
