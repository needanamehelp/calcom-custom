'use client';

import { useEffect, useState } from "react";
import dayjs from "@calcom/dayjs";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { Dialog } from "@calcom/features/components/controlled-dialog";
import { DialogContent, DialogFooter, DialogClose } from "@calcom/ui/components/dialog";
import { TextAreaField, InputField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { Icon } from "@calcom/ui/components/icon";

interface ClientProgressViewProps {
  clientId: string;
  isGuest: boolean;
  userIds?: number[];
  attendeeEmails?: string[];
}

type SessionNote = {
  id: number;
  bookingId: number;
  text: string;
  createdAt: Date;
  sessionNumber?: number;
  sessionTitle?: string;
  startTime?: Date;
  endTime?: Date;
  images?: string[]; // Added for storing extracted image URLs
};

export default function ClientProgressView({ clientId, isGuest, userIds, attendeeEmails }: ClientProgressViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<SessionNote | null>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 10; // More reasonable page size
  
  // Fetch bookings for this client with pagination
  const { data: pastBookings, isLoading: isBookingsLoading } = trpc.viewer.bookings.get.useQuery(
    { 
      filters: {
        status: "past",
        // Filter by userIds or attendeeEmails based on whether it's a guest
        ...((!isGuest && userIds && userIds.length > 0) ? { userIds } : {}),
        ...(isGuest && attendeeEmails && attendeeEmails.length > 0 ? { attendeeEmail: attendeeEmails[0] } : {})
      },
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE
    },
    {
      enabled: !!clientId,
      staleTime: 1 * 60 * 1000, // 1 minute
    }
  );

  // We'll use this to fetch notes individually for each booking
  const utils = trpc.useUtils();

  // Process bookings and fetch notes
  useEffect(() => {
    if (!pastBookings || isBookingsLoading) return;

    const fetchNotes = async () => {
      // Only set loading to true on first page load
      if (page === 0) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const newNotes: SessionNote[] = [];

      // Process each booking to extract notes
      for (const booking of pastBookings.bookings) {
        try {
          if (!booking.id) continue;
          
          // Fetch notes directly using the TRPC client
          const notesData = await utils.viewer.bookings.getInternalNotes.fetch({ bookingId: booking.id });
          if (notesData && notesData.length > 0) {
            // Sort by createdAt (newest first)
            const sortedNotes = [...notesData].sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateB - dateA;
            });
            
            // Get the most recent note
            const mostRecentNote = sortedNotes[0];
            
            // Make sure we have text to work with
            if (mostRecentNote && mostRecentNote.text) {
              // Extract title if it exists in the text (for backward compatibility)
              const titlePattern = /^Title: (.*?)\n/;
              const match = mostRecentNote.text.match(titlePattern);
              
              let sessionTitle = "";
              let noteText = mostRecentNote.text;
              let imageUrls: string[] = [];
              
              if (match && match[1]) {
                sessionTitle = match[1];
                noteText = noteText.replace(titlePattern, '');
              }
              
              // Extract image URLs if present
              const imagesPattern = /--- Images ---\n([\s\S]*)/;
              const imagesMatch = noteText.match(imagesPattern);
              
              if (imagesMatch && imagesMatch[1]) {
                try {
                  // Try to parse the JSON containing the image URLs
                  const imagesJson = JSON.parse(imagesMatch[1]);
                  if (imagesJson.images && Array.isArray(imagesJson.images)) {
                    imageUrls = imagesJson.images;
                  }
                  // Remove the images section from the notes for display
                  noteText = noteText.replace(imagesPattern, '');
                } catch (e) {
                  console.error("Error parsing image URLs from notes:", e);
                }
              }
              
              // Only add the note if we have valid text
              newNotes.push({
                id: mostRecentNote.id,
                bookingId: booking.id,
                text: noteText.trim(),
                createdAt: new Date(mostRecentNote.createdAt),
                sessionTitle: sessionTitle,
                startTime: new Date(booking.startTime),
                endTime: new Date(booking.endTime),
                images: imageUrls,
              });
            }

          }
        } catch (error) {
          console.error(`Error fetching notes for booking ${booking.id}:`, error);
        }
      }

      // Check if we have more to load
      setHasMore(pastBookings.bookings.length === PAGE_SIZE);
      
      // Append new notes to existing notes
      const combinedNotes = [...sessionNotes, ...newNotes];
      
      // Sort all notes by start time (oldest first)
      const sortedNotes = combinedNotes.sort((a, b) => {
        return a.startTime && b.startTime ? 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime() : 0;
      });
      
      // Add session numbers based on chronological order (starting from 1)
      const notesWithNumbers = sortedNotes.map((note, index) => ({
        ...note,
        sessionNumber: index + 1 // 1-indexed
      }));
      
      setSessionNotes(notesWithNumbers);
      setIsLoading(false);
      setIsLoadingMore(false);
    };

    fetchNotes();
  }, [pastBookings, isBookingsLoading, page]);
  
  // Load more handler
  const handleLoadMore = () => {
    setPage(prevPage => prevPage + 1);
  };

  // Function to view full session note
  const handleViewNote = (note: SessionNote) => {
    setSelectedNote(note);
    setIsNoteDialogOpen(true);
  };

  // Render loading state
  if (isLoading || isBookingsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Icon name="loader" className="h-8 w-8 animate-spin text-emphasis" />
        <p className="mt-2 text-sm text-default">Loading session notes...</p>
      </div>
    );
  }

  // Render empty state
  if (sessionNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-md p-6">
        <Icon name="pencil" className="h-12 w-12 text-default" />
        <h3 className="mt-4 text-lg font-medium text-emphasis">No session notes found</h3>
        <p className="mt-2 text-sm text-subtle text-center">
          This client doesn't have any session notes yet. 
          Notes are created when you complete sessions and add notes to them.
        </p>
      </div>
    );
  }

  // Format date and time for display
  const formatDateTime = (date?: Date) => {
    if (!date) return '';
    return dayjs(date).format('MMM D, YYYY [at] h:mm A');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Client Progress</h2>
        <p className="text-sm text-default">
          View all session notes for this client in chronological order.
        </p>
      </div>

      {/* Session notes grid - 3 cards per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessionNotes.map((note, index) => (
          <div key={note.id} className="overflow-hidden shadow-sm border border-subtle rounded-md bg-default transition-all min-h-[220px] flex flex-col">
            <div className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="inline-flex items-center justify-center font-medium bg-gray-100 text-gray-800 h-6 w-6 rounded-full text-xs mr-2">
                    #{note.sessionNumber || index + 1}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDateTime(note.startTime || note.createdAt)}
                </span>
              </div>
              {note.sessionTitle && (
                <p className="font-medium text-sm mt-1 text-subtle line-clamp-1">
                  {note.sessionTitle}
                </p>
              )}
            </div>
            <div className="px-4 pb-2 flex-grow">
              <div className="text-sm text-default mb-2 flex items-center">
                <Icon name="clock" className="h-3 w-3 mr-1 text-default" />
                <span>
                  {dayjs(note.startTime).format('h:mm A')} - {dayjs(note.endTime).format('h:mm A')}
                </span>
              </div>
              <div className="line-clamp-6 text-sm">
                {note.text || 'No notes content'}
              </div>
              {/* Show thumbnail of first image if available */}
              {note.images && note.images.length > 0 && (
                <div className="mt-2 relative h-16 w-16 overflow-hidden rounded">
                  <img 
                    src={note.images[0]} 
                    alt="Session note image" 
                    className="h-full w-full object-cover"
                  />
                  {note.images.length > 1 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-xs font-medium">
                      +{note.images.length - 1} more
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 pt-2 mt-auto">
              <Button 
                color="minimal" 
                size="sm" 
                className="w-full" 
                onClick={() => handleViewNote(note)}
                EndIcon="arrow-right"
              >
                View Full Notes
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button 
            onClick={handleLoadMore} 
            StartIcon={isLoadingMore ? "loader" : undefined}
            disabled={isLoadingMore}
            color="secondary"
            className="min-w-[180px]"
          >
            {isLoadingMore ? "Loading..." : "Load More Sessions"}
          </Button>
        </div>
      )}

      {/* Dialog to view full session note */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        {selectedNote && (
          <DialogContent>
            <div className="mb-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">
                    Session #{selectedNote.sessionNumber}
                  </h3>
                  {selectedNote.sessionTitle && (
                    <h4 className="text-md font-medium">{selectedNote.sessionTitle}</h4>
                  )}
                  <p className="text-sm text-gray-500 flex items-center">
                    <Icon name="calendar" className="h-3 w-3 mr-1 text-subtle" />
                    {formatDateTime(selectedNote.startTime)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="whitespace-pre-wrap">
                {selectedNote.text || 'No notes content'}
              </div>
              
              {/* Display full-size images in the detailed view */}
              {selectedNote.images && selectedNote.images.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Attached Images</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedNote.images.map((imageUrl, index) => (
                      <div key={index} className="rounded-md overflow-hidden border border-gray-200">
                        <img 
                          src={imageUrl} 
                          alt={`Session note image ${index + 1}`} 
                          className="w-full object-contain max-h-96"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <DialogClose className="border" />
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
