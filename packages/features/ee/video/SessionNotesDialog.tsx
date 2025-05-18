import { useState, useEffect } from "react";
import dayjs from "@calcom/dayjs";
import { Dialog } from "@calcom/features/components/controlled-dialog";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { DialogContent, DialogFooter, DialogClose } from "@calcom/ui/components/dialog";
import { TextAreaField, InputField, Label } from "@calcom/ui/components/form";
import { ImageUploader } from "@calcom/ui/components/image-uploader";
import { showToast } from "@calcom/ui/components/toast";
import { Icon } from "@calcom/ui/components/icon";

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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showImageUploader, setShowImageUploader] = useState(false);
  
  const utils = trpc.useUtils();
  
  // Query to get existing notes
  const { data: existingNotes } = trpc.viewer.bookings.getInternalNotes.useQuery(
    { bookingId: booking?.id || 0 },
    {
      enabled: isOpenDialog && !!booking?.id
    }
  );
  
  // Query to count previous sessions with the same attendee
  // We only want to count completed past bookings with the same attendee
  const { data: previousSessions } = trpc.viewer.bookings.get.useQuery(
    { 
      filters: {
        // Only use completed bookings (past = completed in this context)
        status: "past",
        // Filter by primary attendee email if available
        attendeeEmail: booking?.attendees?.[0]?.email || undefined,
        // Only include bookings that happened before the current one
        // We need to use the booking end time (not start time) to match the API's expected parameter
        beforeEndDate: booking?.endTime ? new Date(booking.endTime).toISOString() : undefined
      },
      // Include pagination parameters to ensure we get all results
      limit: 100,
      offset: 0
    },
    {
      enabled: isOpenDialog && !!booking?.id && !!booking?.attendees?.length,
      // This is a potentially expensive query, so let's increase staleTime
      staleTime: 30 * 60 * 1000, // 30 minutes - no need to refresh this frequently
    }
  );

  // Initialize title with booking title when dialog opens
  useEffect(() => {
    if (isOpenDialog && booking?.title) {
      setSessionTitle(booking.title);
    }
  }, [isOpenDialog, booking]);

  // Calculate session number - using a similar approach to ClientProgressView
  useEffect(() => {
    if (!isOpenDialog || !booking) {
      return;
    }
    
    // Use a simpler approach to determine session number
    // First, check if we have previous sessions query data
    if (previousSessions?.bookings) {
      // Get all bookings including the current one
      const allBookings = [...previousSessions.bookings];
      
      // Add current booking if it exists and has start time
      if (booking && booking.startTime) {
        allBookings.push(booking);
      }
      
      // Sort all bookings by start time (oldest first)
      const sortedBookings = allBookings.sort((a, b) => {
        return a.startTime && b.startTime ? 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime() : 0;
      });
      
      // Find the index of the current booking in the sorted list
      const currentBookingIndex = sortedBookings.findIndex(b => 
        b.id === booking.id && b.startTime === booking.startTime
      );
      
      // Session number is the 1-based index
      const sessionNum = currentBookingIndex !== -1 ? currentBookingIndex + 1 : 1;
      
      console.log(`Setting session number to: ${sessionNum} based on position in chronological order`);
      
      // Store the session number
      if (sessionNumber !== sessionNum) {
        setSessionNumber(sessionNum);
      }
    } else {
      // If no previous sessions, this is the first session
      setSessionNumber(1);
    }
  }, [isOpenDialog, previousSessions, booking]);
  
  // Handle existing notes in a separate effect to avoid unnecessary recalculations
  useEffect(() => {
    if (!isOpenDialog) return;
    
    if (!existingNotes || !existingNotes.length) {
      setIsLoading(false);
      return;
    }
    
    try {
      
      // Sort all notes by creation date (newest first)
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
        
        let notesText = mostRecentNote.text;
        
        if (match && match[1]) {
          setSessionTitle(match[1]);
          // Remove the title line from the notes
          notesText = notesText.replace(titlePattern, '');
        }
        
        // Extract image URLs if present
        const imagesPattern = /--- Images ---\n([\s\S]*)/;
        const imagesMatch = notesText.match(imagesPattern);
        
        if (imagesMatch && imagesMatch[1]) {
          try {
            // Try to parse the JSON containing the image URLs
            const imagesJson = JSON.parse(imagesMatch[1]);
            if (imagesJson.images && Array.isArray(imagesJson.images)) {
              setImageUrls(imagesJson.images);
            }
            // Remove the images section from the notes
            notesText = notesText.replace(imagesPattern, '');
          } catch (e) {
            console.error("Error parsing image URLs from notes:", e);
          }
        }
        
        setNotes(notesText.trim());
      }
    } catch (error) {
      console.error("Error processing notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpenDialog, existingNotes]);
  
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
    
    // Format the notes to include the image URLs as JSON
    // This allows us to parse them later
    const notesWithImages = imageUrls.length > 0 ? 
      `${notes}

--- Images ---
${JSON.stringify({images: imageUrls})}` : 
      notes;
    
    // Combine title and notes for storage
    const fullText = sessionTitle ? `Title: ${sessionTitle}
${notesWithImages}` : notesWithImages;
    
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
                Session #{sessionNumber} {/* Already 1-indexed from the useEffect calculation */}
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
            
            {/* Image uploads section */}
            <div className="space-y-2">
              <Label>Add Photos</Label>
              <div className="flex flex-wrap gap-4">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative h-24 w-24 overflow-hidden rounded-md">
                    <img 
                      src={url} 
                      alt={`Session note image ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 rounded-full bg-gray-800 p-1 text-white opacity-70 hover:opacity-100"
                    >
                      <Icon name="trash" className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  color="secondary"
                  StartIcon={showImageUploader ? "x" : "plus"}
                  onClick={() => setShowImageUploader(!showImageUploader)}
                  className="h-24 w-24 border-2 border-dashed"
                >
                  {showImageUploader ? "Cancel" : "Add Image"}
                </Button>
              </div>
              
              {showImageUploader && (
                <div className="mt-4">
                  <ImageUploader
                    id="session-note-image"
                    handleAvatarChange={(url) => {
                      if (url) {
                        setImageUrls(prev => [...prev, url]);
                        setShowImageUploader(false);
                      }
                    }}
                    target="Session Image"
                    buttonMsg="Upload Image"
                    uploadInstruction="Upload a photo of your notes or diagrams"
                  />
                </div>
              )}
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
