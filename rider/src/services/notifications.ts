import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestRideNotificationPermission() {
  if (Platform.OS === 'web') return;
  await Notifications.requestPermissionsAsync();
}

let pushEnabled = true;

export function setPushNotificationsEnabled(value: boolean) {
  pushEnabled = value;
}

let lastNotificationKey = '';
let lastNotificationAt = 0;

export async function notifyRideEvent(title: string, body: string, data: Record<string, string>) {
  if (Platform.OS === 'web' || !pushEnabled) return;
  const key = `${title}\0${body}\0${data.tripId ?? ''}\0${data.screen ?? ''}`;
  const now = Date.now();
  if (key === lastNotificationKey && now - lastNotificationAt < 2000) return;
  lastNotificationKey = key;
  lastNotificationAt = now;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null,
  });
}
