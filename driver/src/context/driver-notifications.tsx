import { useEffect, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { addDriverSocketListener } from '@/services/socket';
import { getActiveChatTripId } from '@/services/active-chat';
import { notifyRideEvent, requestRideNotificationPermission } from '@/services/notifications';

function openFromNotification(data: Record<string, unknown> | undefined) {
  const screen = typeof data?.screen === 'string' ? data.screen : null;
  if (screen === 'support') {
    const ticketId = typeof data?.ticketId === 'string' ? data.ticketId : null;
    if (ticketId) router.push({ pathname: '/trip/support/[id]', params: { id: ticketId } });
    return;
  }
  const tripId = typeof data?.tripId === 'string' ? data.tripId : null;
  if (!tripId) return;
  if (screen === 'chat') {
    router.push({ pathname: '/trip/chat', params: { id: tripId } });
  }
}

export function DriverNotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    void requestRideNotificationPermission();
    const remove = addDriverSocketListener((event, payload) => {
      if (event === 'support:message' && payload && typeof payload === 'object') {
        const body = payload as { ticketId?: string; body?: string };
        const ticketId = typeof body.ticketId === 'string' ? body.ticketId : '';
        if (!ticketId) return;
        void notifyRideEvent('Support replied', body.body?.trim() || 'You have a new message from Eve support.', {
          ticketId,
          screen: 'support',
        });
        return;
      }
      if (event !== 'trip:message' || !payload || typeof payload !== 'object') return;
      const message = payload as { tripId?: string; authorId?: string; body?: string };
      const tripId = typeof message.tripId === 'string' ? message.tripId : '';
      if (!tripId || message.authorId === user?.id || getActiveChatTripId() === tripId) return;
      void notifyRideEvent('Rider messaged you:', message.body?.trim() || 'You have a new chat message.', {
        tripId,
        screen: 'chat',
      });
    });
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification.request.content.data as Record<string, unknown>);
    });
    return () => {
      remove();
      notifSub.remove();
    };
  }, [isAuthenticated, user?.id]);

  return children;
}
