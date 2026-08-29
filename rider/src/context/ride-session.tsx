import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { getActiveTrip, Trip } from '@/services/trips';
import { addSocketListener, connectSocket, disconnectSocket, subscribeTrip } from '@/services/socket';
import { notifyRideEvent, requestRideNotificationPermission } from '@/services/notifications';
import { getActiveChatTripId } from '@/services/active-chat';

type RideSessionValue = {
  activeTrip: Trip | null;
  refreshActive: () => Promise<Trip | null>;
};

const RideSessionContext = createContext<RideSessionValue | null>(null);

function openTripFromNotification(data: Record<string, unknown> | undefined) {
  const tripId = typeof data?.tripId === 'string' ? data.tripId : null;
  const screen = typeof data?.screen === 'string' ? data.screen : null;
  if (!tripId) return;
  if (screen === 'tracking') {
    router.push({ pathname: '/ride/tracking', params: { tripId } });
    return;
  }
  if (screen === 'support') {
    router.push('/ride/support');
    return;
  }
  if (screen === 'chat') {
    router.push({ pathname: '/ride/chat', params: { tripId } });
    return;
  }
  if (screen === 'completed') {
    router.push({ pathname: '/ride/completed', params: { tripId } });
    return;
  }
  router.push({ pathname: '/ride/searching', params: { tripId } });
}

export function RideSessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const tripIdRef = useRef<string | null>(null);

  const refreshActive = useCallback(async () => {
    if (!isAuthenticated) {
      setActiveTrip(null);
      tripIdRef.current = null;
      return null;
    }
    try {
      const trip = await getActiveTrip();
      setActiveTrip(trip);
      tripIdRef.current = trip?.id ?? null;
      if (trip) subscribeTrip(trip.id);
      return trip;
    } catch {
      return null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setActiveTrip(null);
      tripIdRef.current = null;
      return;
    }
    let mounted = true;
    void requestRideNotificationPermission();
    void connectSocket().catch(() => { /* HTTP refresh still loads the trip */ });
    void refreshActive();
    const remove = addSocketListener((event, payload) => {
      if (!mounted) return;
      const body = payload && typeof payload === 'object' ? (payload as { tripId?: string; id?: string; authorId?: string; body?: string }) : {};
      const tripId = String(body.tripId ?? body.id ?? tripIdRef.current ?? '');
      if (event === 'offer:created') {
        void refreshActive();
        void notifyRideEvent('New driver offer', 'A nearby driver sent a fare offer.', {
          tripId,
          screen: 'searching',
        });
      } else if (event === 'trip:assigned') {
        void refreshActive();
        void notifyRideEvent('Driver matched', 'Your driver is on the way.', {
          tripId,
          screen: 'tracking',
        });
      } else if (event === 'trip:cancelled') {
        void refreshActive();
      } else if (event === 'trip:completed') {
        void refreshActive();
        if (tripId) {
          void notifyRideEvent('Ride complete', 'Your trip has ended. Tap to view the summary.', {
            tripId,
            screen: 'completed',
          });
        }
      } else if (event === 'trip:message') {
        if (!tripId || body.authorId === user?.id || getActiveChatTripId() === tripId) return;
        void notifyRideEvent('Driver messaged you:', body.body?.trim() || 'You have a new chat message.', {
          tripId,
          screen: 'chat',
        });
      } else if (event === 'courier:incoming') {
        void notifyRideEvent('Incoming courier', 'Someone is sending a package to you.', {
          tripId,
          screen: 'tracking',
        });
      } else if (event === 'trip:incoming') {
        void notifyRideEvent('Ride booked for you', 'Someone booked an Eve ride for you.', {
          tripId,
          screen: 'tracking',
        });
      } else if (event === 'support:message') {
        void notifyRideEvent('Support replied', 'You have a new message from Eve support.', {
          tripId,
          screen: 'support',
        });
      }
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshActive();
    });
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openTripFromNotification(response.notification.request.content.data as Record<string, unknown>);
    });
    return () => {
      mounted = false;
      remove();
      appSub.remove();
      notifSub.remove();
    };
  }, [isAuthenticated, refreshActive, user?.id]);

  const value = useMemo(() => ({ activeTrip, refreshActive }), [activeTrip, refreshActive]);
  return <RideSessionContext.Provider value={value}>{children}</RideSessionContext.Provider>;
}

export function useRideSession() {
  const context = useContext(RideSessionContext);
  if (!context) throw new Error('useRideSession must be used within RideSessionProvider');
  return context;
}
