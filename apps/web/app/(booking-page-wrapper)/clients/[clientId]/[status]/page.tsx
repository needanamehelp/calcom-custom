import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";

import prisma from "@calcom/prisma";
import { getOptions } from "@calcom/features/auth/lib/next-auth-options";
import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";

// Import client component
import ClientBookings from "../ClientBookings";

// These are the URL statuses that can appear in the URL path
const urlValidStatuses = ["upcoming", "unconfirmed", "recurring", "past", "cancelled"] as const;
// These are the statuses that ClientBookings component accepts
const componentValidStatuses = ["upcoming", "past", "progress", "payments"] as const;

const querySchema = z.object({
  status: z.enum(urlValidStatuses),
});

interface Props {
  params: { clientId: string; status: string };
}

export default async function Page({ params }: Props) {
  // Move auth options inside component scope like we did for the main clients page
  const authOptions = getOptions({
    getDubId: () => undefined,
  });
  
  const session = await getServerSession(authOptions);
  if (!session) return redirect("/login");
  
  // Decode the URL parameter in case it's an encoded email address
  const clientIdOrEmail = decodeURIComponent(params.clientId);
  
  let client = null;
  let isGuest = false;
  
  // Check if the clientId starts with "user-" or "guest-" prefix
  if (clientIdOrEmail.startsWith("user-")) {
    // Extract numeric ID after "user-" prefix
    const userId = Number(clientIdOrEmail.substring(5));
    
    if (!isNaN(userId)) {
      client = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });
    }
  } else if (clientIdOrEmail.startsWith("guest-")) {
    // Extract email after "guest-" prefix
    const guestEmail = clientIdOrEmail.substring(6);
    
    isGuest = true;
    const attendeeExists = await prisma.attendee.findFirst({
      where: { email: guestEmail },
    });
    
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
    
    if (!isNaN(maybeClientId)) {
      // This is a registered user - fetch by ID
      client = await prisma.user.findUnique({
        where: { id: maybeClientId },
        select: { id: true, name: true, email: true },
      });
    } else {
      // This is a guest user - use their email
      isGuest = true;
      // Check if this email exists as an attendee
      const attendeeExists = await prisma.attendee.findFirst({
        where: { email: clientIdOrEmail },
      });
      
      if (attendeeExists) {
        client = {
          name: attendeeExists.name || undefined,
          email: attendeeExists.email,
        };
      } else {
        // Final attempt - maybe this is a user's email?
        const userByEmail = await prisma.user.findFirst({
          where: { email: clientIdOrEmail },
          select: { id: true, name: true, email: true },
        });
        
        if (userByEmail) {
          client = userByEmail;
          isGuest = false;
        }
      }
    }
  }
  
  // If we didn't find a valid client, show an error
  if (!client) {
    return (
      <ShellMainAppDir heading="Client Not Found" subtitle="The requested client couldn't be found">
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Not Found</h2>
          <p className="text-gray-600 mb-6">
            We couldn't find a client matching "{clientIdOrEmail}". Please check the client ID or email and try again.
          </p>
        </div>
      </ShellMainAppDir>
    );
  }

  // Force-normalize the status to ensure it's always correctly set
  const normalizedStatus = params.status ? params.status.toLowerCase() : '';
  
  // Map the URL status to a valid component status
  let mappedStatus: typeof componentValidStatuses[number] = "upcoming";
  
  // Map the URL statuses to component statuses
  if (urlValidStatuses.includes(normalizedStatus as any)) {
    // Direct mappings for statuses that exist in both
    if (normalizedStatus === "upcoming" || normalizedStatus === "past") {
      mappedStatus = normalizedStatus;
    }
    // Map other statuses to their appropriate component status
    else if (normalizedStatus === "recurring" || normalizedStatus === "unconfirmed") {
      mappedStatus = "upcoming";
    } 
    else if (normalizedStatus === "cancelled") {
      mappedStatus = "past";
    }
  }
  
  const status = mappedStatus;
  
  console.log("[SERVER] Client page [status]/page.tsx: Using status", status, "from URL param", params.status);
  
  // Make sure the status is correctly set by logging it prominently
  console.log("================================================================");
  console.log(`⭐ RENDERING CLIENT PAGE WITH STATUS: ${status} (from URL: ${params.status}) ⭐`);
  console.log("================================================================");
    
  // Create the heading and subtitle
  const heading = `Bookings for ${client.name || client.email}`;
  const subtitle = isGuest ? "Guest Client" : client.email;

  return (
    <ShellMainAppDir heading={heading} subtitle={subtitle}>
      <ClientBookings 
        status={status}
        userIds={isGuest ? undefined : client.id ? [client.id] : undefined}
        attendeeEmails={isGuest ? [clientIdOrEmail] : undefined}
        isGuest={isGuest}
      />
    </ShellMainAppDir>
  );
}

export async function generateMetadata({ params }: Props) {
  return {
    title: `Clients | Loopin.pro`,
    description: `View client bookings`,
  };
}