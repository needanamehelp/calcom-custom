'use client';

import Link from "next/link";
import { UserAvatar } from "@calcom/ui/components/avatar";
import { Badge } from "@calcom/ui/components/badge";
import { Icon } from "@calcom/ui/components/icon";

type ClientInfo = {
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
};

interface ClientsListProps {
  clients: Record<string, ClientInfo>;
}

export default function ClientsList({ clients }: ClientsListProps) {
  return (
    <ul className="divide-subtle divide-y">
      {Object.entries(clients).map(([clientId, client]) => {
        // Extract client info
        const { name, email, isGuest, bookings } = client;
        
        // FIXED: Always use email for client paths, regardless of whether they're a guest or registered user
        // This ensures permissions work consistently for all client types
        const clientPath = `/clients/${encodeURIComponent(email)}`;
        
        return (
          <li key={clientId} className="group hover:bg-muted">
            <Link 
              href={clientPath}
              className="flex items-center space-x-4 px-4 py-4"
              prefetch={false}
            >
              <div className="flex-shrink-0">
                <UserAvatar 
                  user={{
                    name: name || email,
                    username: email,
                    avatarUrl: null,
                    profile: { 
                      id: parseInt(clientId), 
                      username: email, 
                      organization: null, 
                      organizationId: null 
                    }
                  }}
                  size="md"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-emphasis text-sm font-medium truncate">
                  {name || email}
                </p>
                <p className="text-default text-sm truncate">{email}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={isGuest ? "gray" : "green"} className="text-xs">
                  {isGuest ? 'Guest' : 'User'}
                </Badge>
                <div className="flex flex-col text-default text-xs">
                  {/* Calculate number of upcoming (ACCEPTED) and unconfirmed (PENDING) bookings */}
                  <span>
                    {bookings.filter(b => new Date(b.startTime) > new Date() && b.status === "ACCEPTED").length} upcoming
                  </span>
                  <span>
                    {bookings.filter(b => b.status === "PENDING").length} unconfirmed
                  </span>
                </div>
                <Icon 
                  name="arrow-right" 
                  className="text-subtle h-4 w-4 group-hover:text-emphasis" 
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
