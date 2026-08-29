import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ActionButton } from '@/components/action-button';

export function FindingBanner({
  destination,
  offerCount,
  cancelling,
  onOpen,
  onCancel,
}: {
  destination: string;
  offerCount: number;
  cancelling: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + pulse.value * 0.2 }],
  }));

  return (
    <Pressable style={styles.card} onPress={onOpen} accessibilityRole="button">
      <View style={styles.row}>
        <View style={styles.radar}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <View style={styles.core}>
            <Feather name="navigation" size={16} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{offerCount ? 'OFFERS READY' : 'FINDING A DRIVER'}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {offerCount ? `${offerCount} driver${offerCount === 1 ? '' : 's'} nearby` : 'Matching nearby drivers'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>{destination}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#9CA3AF" />
      </View>
      <ActionButton
        style={styles.cancel}
        textStyle={styles.cancelText}
        label="Cancel request"
        loadingLabel="Cancelling..."
        loading={cancelling}
        spinnerColor="#B91C1C"
        onPress={onCancel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radar: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48 },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#C7D2FE',
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2E4ED5',
  },
  copy: { flex: 1 },
  eyebrow: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  title: { marginTop: 3, color: '#111827', fontSize: 15, fontWeight: '800' },
  subtitle: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  cancel: { alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cancelText: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
});
