'use client';

import BookingsList from "~/bookings/views/bookings-listing-view";

const validStatuses = ["upcoming", "unconfirmed", "recurring", "past", "cancelled"] as const;
type StatusType = typeof validStatuses[number];

interface ClientBookingsProps {
  status: StatusType;
  userIds?: number[];
  attendeeEmails?: string[];
  isGuest: boolean;
}

export default function ClientBookings({ status, userIds, attendeeEmails, isGuest }: ClientBookingsProps) {
  return (
    <>
      {isGuest && (
        <div className="mb-4 p-3 rounded-md text-sm border border-gray-200">
          This is a guest client without a registered account. Bookings are filtered by email address.
        </div>
      )}
      <BookingsList 
        status={status} 
        userIds={userIds} 
        attendeeEmails={attendeeEmails} 
      />
    </>
  );
}
