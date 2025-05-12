import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSession } from "next-auth";
import prisma from "@calcom/prisma";
import { getOptions } from "@calcom/features/auth/lib/next-auth-options";

// Import client component
import ClientBookings from "./ClientBookings";

const validStatuses = ["upcoming", "unconfirmed", "recurring", "past", "cancelled"] as const;

const querySchema = z.object({
  status: z.enum(validStatuses),
});

interface Props {
  params: { clientId: string; status?: string };
}

export default async function Page({ params }: Props) {
  // Move auth options inside component scope like we did for the main clients page
  const authOptions = getOptions({
    getDubId: () => undefined,
  });
  
  const session = await getServerSession(authOptions);
  if (!session) return redirect("/login");
  
  // Redirect to the "upcoming" tab if no status is provided in the URL
  if (!params.status) {
    return redirect(`/clients/${params.clientId}/upcoming`);
  }
  
  // DIAGNOSTIC: Log raw parameter to see what's coming in from URL
  console.log("[DEBUG] Raw clientId parameter:", params.clientId);
  
  // Decode the URL parameter in case it's an encoded email address
  const clientIdOrEmail = decodeURIComponent(params.clientId);
  console.log("[DEBUG] Decoded clientId parameter:", clientIdOrEmail);
  
  let client = null;
  let isGuest = false;
  // Define a type for attempt entries that covers all the variations we'll be adding
  type AttemptEntry = 
    | { type: string; value: string } 
    | { type: string; value: number } 
    | { type: string; value: number; isValid: boolean };
    
  let diagnosticInfo = {
    attempts: [] as AttemptEntry[],
    rawParam: params.clientId,
    decodedParam: clientIdOrEmail
  };
  
  // Check if the clientId starts with "user-" or "guest-" prefix
  // This addresses a potential mismatch with how the ClientsList generates IDs
  if (clientIdOrEmail.startsWith("user-")) {
    // Extract numeric ID after "user-" prefix
    const userId = Number(clientIdOrEmail.substring(5));
    console.log("[DEBUG] Extracted user ID from prefixed ID:", userId);
    diagnosticInfo.attempts.push({ type: "prefixed-user", value: userId });
    
    if (!isNaN(userId)) {
      client = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });
      console.log("[DEBUG] User lookup by prefixed ID result:", !!client);
    }
  } else if (clientIdOrEmail.startsWith("guest-")) {
    // Extract email after "guest-" prefix
    const guestEmail = clientIdOrEmail.substring(6);
    console.log("[DEBUG] Extracted email from prefixed ID:", guestEmail);
    diagnosticInfo.attempts.push({ type: "prefixed-guest", value: guestEmail });
    
    isGuest = true;
    const attendeeExists = await prisma.attendee.findFirst({
      where: { email: guestEmail },
    });
    console.log("[DEBUG] Guest lookup by prefixed email result:", !!attendeeExists);
    
    if (attendeeExists) {
      client = {
        name: attendeeExists.name || undefined,
        email: attendeeExists.email,
      };
    }
  }
  
  // If prefixed lookup failed, try standard lookup methods
  if (!client) {
    // Check if the clientId is a number (registered user) or string (guest email)
    const maybeClientId = Number(clientIdOrEmail);
    console.log("[DEBUG] Attempting numeric conversion:", maybeClientId, "isNaN:", isNaN(maybeClientId));
    diagnosticInfo.attempts.push({ type: "numeric", value: maybeClientId, isValid: !isNaN(maybeClientId) });
    
    if (!isNaN(maybeClientId)) {
      // This is a registered user - fetch by ID
      client = await prisma.user.findUnique({
        where: { id: maybeClientId },
        select: { id: true, name: true, email: true },
      });
      console.log("[DEBUG] User lookup by ID result:", !!client);
    } else {
      // This is a guest user - use their email
      isGuest = true;
      diagnosticInfo.attempts.push({ type: "email", value: clientIdOrEmail });
      
      // Check if the guest exists by looking for bookings with this email
      const attendeeExists = await prisma.attendee.findFirst({
        where: { email: clientIdOrEmail },
      });
      console.log("[DEBUG] Guest lookup by email result:", !!attendeeExists);
      
      if (attendeeExists) {
        client = {
          name: attendeeExists.name || undefined,
          email: attendeeExists.email,
        };
      }
    }
  }
  
  // If client doesn't exist, show diagnostic info and provide redirection options
  if (!client) {
    // Log the full diagnostic information for server-side debugging
    console.log("[DEBUG] Client lookup diagnostic info:", JSON.stringify(diagnosticInfo, null, 2));
    
    // Check attendee existence more broadly to help understand where the data might be
    const allAttendees = await prisma.attendee.findMany({
      where: {
        OR: [
          // Try exact email match
          { email: clientIdOrEmail },
          // Try with trailing/leading spaces removed
          { email: clientIdOrEmail.trim() },
          // Try with lowercase
          { email: clientIdOrEmail.toLowerCase() },
          // Try with name match for guests
          { name: clientIdOrEmail }
        ]
      },
      take: 10, // Limit to 10 matches for safety
      select: { id: true, name: true, email: true, bookingId: true }
    });
    
    console.log("[DEBUG] Extended attendee search results:", JSON.stringify(allAttendees, null, 2));
    
    // Create an encoded filter parameter for booking search fallback
    // Format the filter to search for bookings with attendee name/email matching this client
    const filterParam = encodeURIComponent(
      JSON.stringify({
        f: "attendeeName",
        v: {
          type: "t",
          data: {
            operator: "equals",
            operand: clientIdOrEmail
          }
        }
      })
    );
    
    // Helper function to create links for all booking status tabs with filters preserved
    const generateFilteredStatusLink = (statusType: string) => {
      return `/bookings/${statusType}?activeFilters=${filterParam}`;
    };
    
    // Generate links for all booking status tabs with the filter preserved
    const statusLinks = {
      upcoming: generateFilteredStatusLink("upcoming"),
      unconfirmed: generateFilteredStatusLink("unconfirmed"),
      recurring: generateFilteredStatusLink("recurring"),
      past: generateFilteredStatusLink("past"),
      cancelled: generateFilteredStatusLink("cancelled")
    };
    
    // For development: Show diagnostic UI with the option to redirect manually
    // In production, you could set REDIRECT_AUTOMATICALLY=true
    const REDIRECT_AUTOMATICALLY = false;
    
    if (REDIRECT_AUTOMATICALLY) {
      // Redirect to the bookings page with the filter applied
      return redirect(statusLinks.upcoming);
    }
    
    // Otherwise show diagnostic information
    return (
      <ShellMainAppDir heading="Client Lookup Diagnostic">
        <div className="p-8 space-y-4">
          <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 text-yellow-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Client lookup failed</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Could not find client with identifier: <code className="bg-yellow-100 px-1 rounded">{clientIdOrEmail}</code>
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Diagnostic Information</h2>
            <div className="bg-gray-100 p-3 rounded-md overflow-auto max-h-64">
              <pre className="text-xs">{JSON.stringify(diagnosticInfo, null, 2)}</pre>
            </div>
          </div>
          
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Similar Attendees Found ({allAttendees.length})</h2>
            {allAttendees.length > 0 ? (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
                {allAttendees.map((attendee) => (
                  <li key={attendee.id} className="p-3 hover:bg-gray-50">
                    <div><span className="font-medium">Name:</span> {attendee.name || "<No name>"}</div>
                    <div><span className="font-medium">Email:</span> {attendee.email}</div>
                    <div className="mt-1">
                      <a 
                        href={`/bookings/upcoming?activeFilters=${encodeURIComponent(
                          JSON.stringify({
                            f: "attendeeName",
                            v: {
                              type: "t",
                              data: {
                                operator: "equals",
                                operand: attendee.email
                              }
                            }
                          })
                        )}`} 
                        className="text-blue-500 hover:underline text-sm"
                      >
                        View associated bookings →
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-gray-50 p-4 rounded-md text-gray-500 text-sm">
                No similar attendees found in the database.
              </div>
            )}
          </div>
          
          <div className="mt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-3">View Client Bookings By Status</h2>
              <div className="flex flex-wrap gap-2">
                <a href={statusLinks.upcoming} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm">
                  Upcoming Bookings
                </a>
                <a href={statusLinks.unconfirmed} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm">
                  Unconfirmed
                </a>
                <a href={statusLinks.recurring} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm">
                  Recurring
                </a>
                <a href={statusLinks.past} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm">
                  Past
                </a>
                <a href={statusLinks.cancelled} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm">
                  Cancelled
                </a>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                All links preserve the filter for this client's email or name
              </p>
            </div>
            
            <div className="flex justify-between border-t pt-4">
              <a href="/clients" className="text-blue-500 hover:underline">← Back to clients list</a>
            </div>
          </div>
        </div>
      </ShellMainAppDir>
    );
  }

  // Determine status tab
  const status = params.status && validStatuses.includes(params.status as typeof validStatuses[number])
    ? params.status as typeof validStatuses[number]
    : "upcoming" as typeof validStatuses[number];
    
  // Create the heading and subtitle
  const heading = `Bookings for ${client.name || client.email}`;
  const subtitle = isGuest ? "Guest Client" : client.email;

  // Define props with the correct type to match BookingsList component's requirements
  const bookingsProps: { 
    status: typeof validStatuses[number]; 
    userIds?: number[]; 
    attendeeEmails?: string[] 
  } = { status };
  
  // Add the right filter prop based on client type
  if (isGuest) {
    bookingsProps.attendeeEmails = [clientIdOrEmail]; 
  } else if (client.id) {
    bookingsProps.userIds = [client.id];
  }

  // Create tabs with proper links to status pages
  const clientTabs = validStatuses.map((tabStatus) => ({
    name: tabStatus,
    href: `/clients/${params.clientId}/${tabStatus}`,
    'data-testid': tabStatus,
  }));

  return (
    <ShellMainAppDir heading={heading} subtitle={subtitle}>
      <div className="mt-8">
        <div className="mb-8">
          {/* Add horizontal tab navigation */}
          <nav className="no-scrollbar mb-4 flex items-center justify-start space-x-2 overflow-x-auto">
            {clientTabs.map((tab) => (
              <a
                key={tab.name}
                href={tab.href}
                className={`text-default min-w-fit whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium ${status === tab.name ? 'bg-emphasis text-emphasis' : 'hover:bg-subtle'}`}
                data-testid={tab['data-testid']}
              >
                {tab.name.charAt(0).toUpperCase() + tab.name.slice(1)}
              </a>
            ))}
          </nav>
        </div>
        <ClientBookings 
          status={status}
          userIds={isGuest ? undefined : client.id ? [client.id] : undefined}
          attendeeEmails={isGuest ? [clientIdOrEmail] : undefined}
          isGuest={isGuest}
        />
      </div>
    </ShellMainAppDir>
  );
}

export async function generateMetadata({ params }: Props) {
  // Decode the URL parameter here too
  const clientIdOrEmail = decodeURIComponent(params.clientId);
  let clientName = clientIdOrEmail;
  
  // Check if it's a numeric ID (user) or string (email)
  const maybeClientId = Number(clientIdOrEmail);
  
  if (!isNaN(maybeClientId)) {
    // This is a registered user - fetch by ID
    const client = await prisma.user.findUnique({
      where: { id: maybeClientId },
      select: { name: true, email: true },
    });
    clientName = client?.name || client?.email || clientIdOrEmail;
  } else {
    // This is a guest user - use their email
    const attendee = await prisma.attendee.findFirst({
      where: { email: clientIdOrEmail },
      select: { name: true },
    });
    clientName = attendee?.name || clientIdOrEmail;
  }
  
  return {
    title: `Client: ${clientName}`,
  };
}
