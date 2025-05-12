import { getServerSession } from "next-auth";
import { getOptions } from "@calcom/features/auth/lib/next-auth-options";
import prisma from "@calcom/prisma";
import { notFound } from "next/navigation";
import { BookingStatus } from "@calcom/prisma/enums";

// Cal.com UI Components
import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";

// Import the client component for rendering the list
import ClientsList from "./ClientsList";

interface ClientInfo {
  id?: number;
  name: string;
  email: string;
  isGuest: boolean;
  bookings: Array<{
    id: number;
    startTime: Date;
    endTime: Date;
    status: string;
    eventTitle?: string;
  }>;
}

async function getClients(userId: string): Promise<Record<string, ClientInfo>> {
  // First get all bookings this user is involved with
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        // User created these events
        { userId: Number(userId) },
        // User owns these event types
        { eventType: { userId: Number(userId) } },
        // User is part of team events
        { eventType: { team: { members: { some: { userId: Number(userId) } } } } },
      ],
    },
    include: {
      attendees: true,
      eventType: true,
    },
    orderBy: { startTime: "desc" },
  });

  console.log(`Found ${bookings.length} bookings for user ${userId}`);

  // Get current user's email to exclude them from attendees
  const currentUser = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { email: true },
  });

  if (!currentUser) {
    return {};
  }

  // Create a map of clients with their booking info
  const clients: Record<string, ClientInfo> = {};

  // Process all bookings
  for (const booking of bookings) {
    // Skip bookings without attendees
    if (!booking.attendees || booking.attendees.length === 0) continue;

    // Process each attendee who isn't the current user
    for (const attendee of booking.attendees) {
      // Skip if this is the current user
      if (attendee.email === currentUser.email) continue;

      // Find if this attendee has a user account
      const attendeeUser = await prisma.user.findFirst({
        where: { email: attendee.email },
        select: { id: true, name: true, email: true },
      });

      // Create a unique client ID
      const clientId = attendeeUser ? `user-${attendeeUser.id}` : `guest-${attendee.email}`;

      // Create or update client info
      if (!clients[clientId]) {
        clients[clientId] = {
          id: attendeeUser?.id,
          name: attendeeUser?.name || attendee.name || "Guest",
          email: attendee.email,
          isGuest: !attendeeUser,
          bookings: [],
        };
      }

      // Add this booking to the client's bookings
      clients[clientId].bookings.push({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        eventTitle: booking.eventType?.title,
      });
    }
  }

  return clients;
}

function categorizeBookings(bookings: ClientInfo['bookings']) {
  const now = new Date();
  return {
    Past: bookings.filter(b => b.endTime && b.endTime < now),
    Upcoming: bookings.filter(b => b.startTime && b.startTime > now && b.status === BookingStatus.ACCEPTED),
    Cancelled: bookings.filter(b => b.status === BookingStatus.CANCELLED),
    Unconfirmed: bookings.filter(b => b.status === BookingStatus.PENDING),
    // We don't have recurringEventId in our simplified structure
    Recurring: [],
  };
}

export async function generateMetadata() {
  return {
    title: `Clients | Loopin.pro`,
    description: `View and manage your clients`,
  };
}

export default async function ClientsPage() {
  // Get auth options with a simple inline getDubId function
  const authOptions = getOptions({
    getDubId: () => undefined,
  });
  
  // Get session using next-auth
  const session = await getServerSession(authOptions);
  if (!session) return notFound();
  const userId = session.user.id;
  const clients = await getClients(userId.toString());

  return (
    <ShellMainAppDir heading="Clients">
      <div className="mt-8">
        {Object.entries(clients).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-md border border-dashed p-7">
            <h2 className="text-emphasis text-xl font-semibold mb-2">No clients found</h2>
            <p className="text-default">When people book with you, they'll appear here.</p>
          </div>
        ) : (
          <div className="bg-default border-subtle rounded-md border">
            <div className="border-subtle bg-subtle px-4 py-5 sm:px-6 border-b">
              <h3 className="text-emphasis text-lg font-medium leading-6">Your Clients</h3>
              <p className="text-default mt-1 max-w-2xl text-sm">People who have booked with you</p>
            </div>
            {/* Use the client component to render the list */}
            <ClientsList clients={clients} />
          </div>
        )}
      </div>
    </ShellMainAppDir>
  );
}
