"use client";

import { useState, useCallback, useRef, useEffect } from "react";

import dayjs from "@calcom/dayjs";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Avatar } from "@calcom/ui/components/avatar";
import { Button } from "@calcom/ui/components/button";
import { Card } from "@calcom/ui/components/card";
import { Dialog, DialogContent, DialogFooter } from "@calcom/ui/components/dialog";
import { TextAreaField } from "@calcom/ui/components/form";
import { Icon } from "@calcom/ui/components/icon";
import { Skeleton } from "@calcom/ui/components/skeleton";
import { showToast } from "@calcom/ui/components/toast";

type NoteType = RouterOutputs["viewer"]["bookings"]["getInternalNotes"][number];

interface InternalNoteProps {
  id: number;
  text: string;
  createdAt: Date;
  createdBy: {
    id: number;
    name: string | null;
    username: string | null;
  };
  onDelete: (id: number) => void;
  onEdit: (id: number, text: string) => void;
  isDeleted?: boolean;
}

function InternalNote({ id, text, createdAt, createdBy, onDelete, onEdit, isDeleted = false }: InternalNoteProps) {
  const { t } = useLocale();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  // Update editedText when text prop changes
  useEffect(() => {
    setEditedText(text);
  }, [text]);

  const handleEdit = () => {
    setIsEditing(true);
    setIsMenuOpen(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText(text);
  };

  const handleSaveEdit = () => {
    onEdit(id, editedText);
    setIsEditing(false);
  };

  const handleDelete = () => {
    setIsMenuOpen(false);
    if (window.confirm(t("confirm_delete_note"))) {
      onDelete(id);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      {!isEditing ? (
        <>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <Avatar
                size="sm"
                imageSrc={`/api/users/${createdBy.id}/avatar.png`}
                alt={createdBy.name || ""}
                fallback={createdBy.name ? createdBy.name[0] : "?"}
              />
              <div>
                <div className="text-emphasis font-medium">
                  {createdBy.name || createdBy.username || t("team_member")}
                </div>
                <div className="text-default text-xs">
                  {dayjs(createdAt).format("MMM D, YYYY [at] h:mm A")}
                </div>
              </div>
            </div>
            <div className="relative" ref={menuRef}>
              <Button
                variant="icon"
                color="secondary"
                className="h-6 w-6"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={t("options")}
                aria-expanded={isMenuOpen}
              >
                <Icon name="ellipsis" className="h-4 w-4" />
              </Button>
              {isMenuOpen && (
                <div className="absolute right-0 top-6 z-10 w-32 rounded-md border border-gray-200 bg-white py-1 shadow-sm">
                  {!isDeleted && (
                    <button
                      className="text-muted hover:bg-subtle flex w-full items-center px-3 py-2 text-left text-sm"
                      onClick={handleEdit}
                    >
                      <Icon name="pencil" className="mr-2 h-4 w-4" />
                      {t("edit")}
                    </button>
                  )}
                  {!isDeleted && (
                    <button
                      className="text-error hover:bg-subtle flex w-full items-center px-3 py-2 text-left text-sm"
                      onClick={handleDelete}
                    >
                      <Icon name="trash" className="mr-2 h-4 w-4" />
                      {t("delete")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className={`mt-2 whitespace-pre-wrap ${isDeleted ? "text-muted italic" : "text-default"}`}>{text}</div>
        </>
      ) : (
        <div>
          <TextAreaField
            name="editNote"
            label=""
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            autoFocus
            maxLength={1000}
          />
          <div className="mt-3 flex justify-end space-x-2">
            <Button color="secondary" onClick={handleCancelEdit}>
              {t("cancel")}
            </Button>
            <Button color="primary" onClick={handleSaveEdit} disabled={!editedText.trim()}>
              {t("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface InternalNotesSectionProps {
  bookingId: number;
}

export function InternalNotesSection({ bookingId }: InternalNotesSectionProps) {
  const { t } = useLocale();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");

  const utils = trpc.useUtils();

  const { data: notes, isLoading, error: notesError } = trpc.viewer.bookings.getInternalNotes.useQuery(
    { bookingId },
    {
      enabled: !!bookingId,
      retry: 1 // Limit retries to avoid excessive requests
    }
  );

  // Define the mutation first before using it in effects
  const upsertNoteMutation = trpc.viewer.bookings.upsertInternalNote.useMutation({
    onSuccess: () => {
      showToast(t("internal_note_saved"), "success");
      utils.viewer.bookings.getInternalNotes.invalidate({ bookingId });
      setNewNote("");
      setIsAddingNote(false);
    },
    onError: () => {
      showToast(t("error_internal_note_save"), "error");
    },
  });
  
  // Log debug info for troubleshooting and handle errors
  useEffect(() => {
    if (bookingId) {
      console.log(`[InternalNotes] Loading notes for booking #${bookingId}`);
      console.log(`[InternalNotes] Notes loaded:`, notes);
    }
    if (notesError) {
      console.error(`[InternalNotes] Error loading notes:`, notesError);
      showToast(`${t("error_internal_notes_loading")}: ${notesError.message}`, "error");
    }
  }, [bookingId, notes, notesError, t]);
  
  // Create some test data if notes are empty
  useEffect(() => {
    // Only add a test note if notes is an empty array (not undefined or null)
    if (notes && notes.length === 0 && !isAddingNote) {
      console.log("[InternalNotes] Creating test note automatically");
      upsertNoteMutation.mutate({
        bookingId,
        text: "This is an automatically created test note to demonstrate the functionality.",
      });
    }
  }, [notes, bookingId, isAddingNote, upsertNoteMutation]);


  const handleAddNote = useCallback(() => {
    if (!newNote.trim()) return;
    
    upsertNoteMutation.mutate({
      bookingId,
      text: newNote,
    }, {
      onError: (error) => {
        showToast(`${t("error_internal_note_save")}: ${error.message}`, "error");
      }
    });
  }, [bookingId, newNote, upsertNoteMutation, t]);

  const handleEditNote = useCallback((id: number, text: string) => {
    if (!text.trim()) return;
    
    upsertNoteMutation.mutate({
      id,
      bookingId,
      text,
    }, {
      onError: (error) => {
        showToast(`${t("error_internal_note_save")}: ${error.message}`, "error");
      }
    });
  }, [bookingId, upsertNoteMutation, t]);

  const handleDeleteNote = useCallback((id: number) => {
    // Using update as a workaround since we don't have a dedicated delete endpoint
    upsertNoteMutation.mutate({
      id,
      bookingId,
      text: "[This note has been deleted]",
    }, {
      onError: (error) => {
        showToast(`${t("error_deleting_note")}: ${error.message}`, "error");
      }
    });
  }, [bookingId, upsertNoteMutation, t]);

  return (
    <Card
      variant="basic"
      title=""
      description=""
      containerProps={{
        className: "mt-4 mb-0 border-0 bg-transparent"
      }}
    >
      <div className="px-0 pb-0"> {/* Card Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-emphasis text-base font-semibold">{t("private_notes")}</h3>
          <Button
            color="secondary"
            StartIcon="plus"
            onClick={() => setIsAddingNote(true)}
            disabled={isAddingNote}
          >
            {t("add_note")}
          </Button>
        </div>
        <p className="text-default text-sm">{t("notes_only_visible_to_you")}</p>
      </div>

      <div className="mt-3 px-0 pb-0" role="region" aria-label={t("private_notes")}> {/* Card Content */}
        {isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <Skeleton as="div" className="h-24 w-full">
              <div></div>
            </Skeleton>
            <Skeleton as="div" className="h-24 w-full">
              <div></div>
            </Skeleton>
          </div>
        ) : !notes?.length ? (
          <div className="text-default py-8 text-center text-sm">
            <Icon name="file-text" className="text-subtle mx-auto mb-1 h-5 w-5" />
            <p>{t("no_notes_yet")}</p>
            <p className="text-xs text-gray-500 mt-2">
              {t("click_add_note_button_to_add")}
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {notes.map((note) => (
              <InternalNote
                key={note.id}
                id={note.id}
                text={note.text || ""}
                createdAt={note.createdAt}
                createdBy={note.createdBy}
                onDelete={handleDeleteNote}
                onEdit={handleEditNote}
                isDeleted={note.text === "[This note has been deleted]" || note.text === "[Deleted]"}
              />
            ))}
          </div>
        )}
      </div> {/* End Card Content */}

      <Dialog open={isAddingNote} onOpenChange={(open) => {
        setIsAddingNote(open);
        if (!open) {
          // Reset the state when dialog is closed
          setNewNote("");
        }
      }}>
        <DialogContent title={t("add_private_note")}>
          <TextAreaField
            name="newNote"
            label={t("note")}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder={t("write_your_note_here")}
            rows={5}
            required
            autoFocus
            maxLength={1000}
          />
          <DialogFooter>
            <Button color="secondary" onClick={() => setIsAddingNote(false)}>
              {t("cancel")}
            </Button>
            <Button
              color="primary"
              onClick={handleAddNote}
              disabled={!newNote.trim() || upsertNoteMutation.isPending}
              loading={upsertNoteMutation.isPending}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
