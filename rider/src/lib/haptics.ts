import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function lightImpact() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
