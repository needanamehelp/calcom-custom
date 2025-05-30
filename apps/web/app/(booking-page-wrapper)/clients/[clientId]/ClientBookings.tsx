'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import BookingsList from "~/bookings/views/bookings-listing-view";
import ClientProgressView from "./ClientProgressView";
import ClientPaymentsTab from "./ClientPaymentsTab";

type ClientParams = {
  clientId: string;
};

const validStatuses = ["upcoming", "past", "progress", "payments"] as const;
type StatusType = typeof validStatuses[number];

interface ClientBookingsProps {
  status: StatusType;
  userIds?: number[];
  attendeeEmails?: string[];
  isGuest: boolean;
}

// Component for handling client bookings

export default function ClientBookings({ status, userIds, attendeeEmails, isGuest }: ClientBookingsProps) {
  // Get the client ID and current pathname
  const params = useParams<ClientParams>();
  const clientId = params?.clientId || '';
  const pathname = usePathname();

  // Extract current status from URL for accurate tab highlighting
  const [currentStatus, setCurrentStatus] = useState<StatusType>(status as StatusType || "upcoming");

  // Update status when pathname changes
  useEffect(() => {
    const pathParts = pathname?.split("/") || [];
    const lastPart = pathParts[pathParts.length - 1];
    
    if (validStatuses.includes(lastPart as StatusType)) {
      setCurrentStatus(lastPart as StatusType);
    }
  }, [pathname]);

  // Create tabs with proper active states
  const clientTabs = validStatuses.map((tabStatus) => ({
    name: tabStatus.charAt(0).toUpperCase() + tabStatus.slice(1),
    href: `/clients/${clientId}/${tabStatus}`,
    isActive: currentStatus === tabStatus,
  }));

  // Determine if we should show the progress view
  const showProgressView = currentStatus === "progress";

  return (
    <>
      {isGuest && (
        <div className="mb-4 p-3 rounded-md text-sm border border-gray-200">
          This is a guest client without a registered account. Bookings are filtered by email address.
        </div>
      )}
      
      {/* Tab navigation with working active tab highlighting */}
      <nav className="no-scrollbar mb-4 flex items-center justify-start space-x-2 overflow-x-auto">
        {clientTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={true}
            className={`text-default min-w-fit whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium ${
              tab.isActive ? 'bg-emphasis text-emphasis' : 'hover:bg-subtle'
            }`}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
      
      {showProgressView ? (
        <ClientProgressView 
          clientId={clientId}
          isGuest={isGuest}
          userIds={userIds} 
          attendeeEmails={attendeeEmails}
        />
      ) : currentStatus === "payments" ? (
        <ClientPaymentsTab
          clientId={clientId}
          isGuest={isGuest}
        />
      ) : (
        <BookingsList 
          key={`client-bookings-${clientId}`}
          status={currentStatus} 
          userIds={userIds} 
          attendeeEmails={attendeeEmails}
          hideTabs={true}
        />
      )}
    </>
  );
}
