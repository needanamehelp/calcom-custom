'use client';

import { useState, useEffect } from 'react';
import dayjs from '@calcom/dayjs';
import { useLocale } from '@calcom/lib/hooks/useLocale';
import { trpc } from '@calcom/trpc/react';
import { BookingStatus } from '@calcom/prisma/enums';
import { Skeleton } from '@calcom/ui/components/skeleton';
import { Badge } from '@calcom/ui/components/badge';
import { Icon } from '@calcom/ui/components/icon';

interface ClientPaymentsTabProps {
  clientId: string;
  isGuest: boolean;
}

type PaymentHistoryItem = {
  id: number;
  bookingId: number;
  amount: number;
  currency: string;
  status: 'paid' | 'pending';
  date: Date;
  serviceName: string;
  bookingStatus: BookingStatus;
};

export default function ClientPaymentsTab({ clientId, isGuest }: ClientPaymentsTabProps) {
  const { t } = useLocale();
  const [isLoading, setIsLoading] = useState(true);

  // Fetch client payment stats with simple configuration
  const { data: paymentStats, isError, error, isFetched } = trpc.viewer.payments.getClientPaymentStats.useQuery(
    { clientId, isGuest },
    {
      enabled: !!clientId,
      staleTime: 5 * 60 * 1000, // 5 minutes cache
    }
  );
  
  // Use useEffect to handle loading state changes
  useEffect(() => {
    if (isFetched) {
      setIsLoading(false);
    }
    
    if (isError) {
      console.error('Error fetching payment stats:', error);
      setIsLoading(false);
    }
  }, [isFetched, isError, error]);

  // Format currency amount
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100); // Assuming amount is stored in cents
  };

  // Format date
  const formatDate = (date: Date) => {
    return dayjs(date).format('MMM D, YYYY');
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: 'paid' | 'pending' }) => {
    if (status === 'paid') {
      return (
        <Badge variant="success" className="text-xs">
          {t('paid')}
        </Badge>
      );
    }
    return (
      <Badge variant="orange" className="text-xs">
        {t('pending')}
      </Badge>
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton as="div" className="h-8 w-60">
            <div />
          </Skeleton>
          <div className="flex space-x-3">
            <Skeleton as="div" className="h-12 w-32">
              <div />
            </Skeleton>
            <Skeleton as="div" className="h-12 w-32">
              <div />
            </Skeleton>
          </div>
        </div>
        <Skeleton as="div" className="h-64 w-full">
          <div />
        </Skeleton>
      </div>
    );
  }

  // No payment history - handle both null/undefined paymentStats and empty payment history arrays
  // Also handle cases where loading completes but data is empty
  if (isError || !paymentStats || !paymentStats.paymentHistory || paymentStats.paymentHistory.length === 0) {
    return (
      <div className="py-10 text-center">
        <Icon name="credit-card" className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">{t('no_payment_history', 'No Payment History')}</h3>
        <p className="text-gray-500 mt-1">{t('no_payments_made_by_this_client')}</p>
      </div>
    );
  }

  const { summary, paymentHistory } = paymentStats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold">{t('payment_history')}</h2>
        <div className="flex space-x-3">
          <div className="p-3 rounded-md bg-green-50 border border-green-100 text-center">
            <span className="text-xs text-gray-500 block">{t('collected')}</span>
            <span className="text-green-600 font-medium">
              {formatCurrency(summary.totalCollected, summary.currency)}
            </span>
          </div>
          <div className="p-3 rounded-md bg-amber-50 border border-amber-100 text-center">
            <span className="text-xs text-gray-500 block">{t('pending')}</span>
            <span className="text-amber-600 font-medium">
              {formatCurrency(summary.totalPending, summary.currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">{t('date')}</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">{t('service')}</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">{t('amount')}</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-left">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paymentHistory.map((payment) => {
                // Ensure payment status is either 'paid' or 'pending'
                const status = payment.status === 'paid' ? 'paid' : 'pending';
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3 text-sm">{payment.serviceName}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
