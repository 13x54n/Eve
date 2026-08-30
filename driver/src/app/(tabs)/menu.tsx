import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, type Href } from 'expo-router';
import { getDriverProfile } from '@/services/driver';
import { useAuth } from '@/context/auth-context';
import { Brand, Spacing } from '@/constants/theme';
import { useBrand } from '@/context/theme-context';
import { lightImpact } from '@/lib/haptics';
import { ActionButton } from '@/components/action-button';

type MenuRow = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
};

function SettingsSection({ title, rows }: { title: string; rows: MenuRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            style={[styles.row, index < rows.length - 1 ? styles.rowBorder : null]}
            onPress={row.onPress}
          >
            <View style={styles.icon}>
              <Feather name={row.icon} size={18} color={Brand.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              {row.detail ? <Text style={styles.rowDetail}>{row.detail}</Text> : null}
            </View>
            <Feather name="chevron-right" size={18} color={Brand.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MenuScreen() {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getDriverProfile().then((driver) => { if (mounted) setProfile(driver); }).catch(() => { /* keep placeholder state */ });
      return () => { mounted = false; };
    }, []),
  );

  const vehicle = profile?.vehicles?.[0];
  const vehicleSublabel = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`
    : 'Add your vehicle details';
  const personalInfoSublabel = profile?.user
    ? [profile.user.email, profile.user.phone].filter(Boolean).join(' · ') || 'Add email and phone'
    : 'Name, phone, email';
  const initial = (profile?.user?.name ?? '?').trim().charAt(0).toUpperCase() || '?';

  const handleSignOut = () => {
    if (signingOut) return;
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setSigningOut(true);
              await logout();
              lightImpact();
              router.replace('/(auth)/welcome');
            } catch {
              setSigningOut(false);
              Alert.alert('Could not sign out', 'Please try again.');
            }
          })();
        },
      },
    ]);
  };

  const accountRows: MenuRow[] = [
    {
      icon: 'user',
      title: 'Personal information',
      detail: personalInfoSublabel,
      onPress: () => router.push('/profile/edit' as Href),
    },
    {
      icon: 'truck',
      title: 'Vehicle management',
      detail: vehicleSublabel,
      onPress: () => router.push('/onboarding/vehicle' as Href),
    },
    {
      icon: 'file-text',
      title: 'Documents',
      detail: 'License, insurance, background check',
      onPress: () => router.push('/onboarding/documents' as Href),
    },
  ];

  const resourceRows: MenuRow[] = [
    {
      icon: 'life-buoy',
      title: 'Support',
      onPress: () => router.push('/trip/support' as Href),
    },
    {
      icon: 'file',
      title: 'Terms & privacy',
      onPress: () => router.push('/legal' as Href),
    },
  ];

  const preferenceRows: MenuRow[] = [
    {
      icon: 'bell',
      title: 'Notifications & appearance',
      detail: 'Ride updates and appearance',
      onPress: () => router.push('/profile/notifications' as Href),
    },
    {
      icon: 'lock',
      title: 'Security',
      detail: 'Password',
      onPress: () => router.push('/profile/security' as Href),
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: brand.canvas }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.topBarTitle}>Menu</Text>
        <Pressable style={styles.profileCard} onPress={() => router.push('/profile/edit' as Href)}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.user?.name ?? 'Loading...'}</Text>
            <Text style={styles.tripsText}>
              {profile?.rating ? `${Number(profile.rating).toFixed(2)} · ` : ''}
              {profile?.city ?? 'No city set'}
            </Text>
          </View>
        </Pressable>
        <View
          style={styles.list}
        >
          <SettingsSection title="Account" rows={accountRows} />
          <SettingsSection title="Resources" rows={resourceRows} />
          <SettingsSection title="Preferences" rows={preferenceRows} />
        </View>
        <View style={{ paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 64 : 12) }}>
          <ActionButton
            style={styles.signOutButton}
            textStyle={styles.signOutText}
            label="Sign out"
            loadingLabel="Signing out..."
            loading={signingOut}
            onPress={handleSignOut}
          />
          <Text style={styles.versionText}>Eve Driver · v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.canvas,
    paddingHorizontal: Spacing.three,
  },
  topBarTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
    paddingTop: Platform.OS === 'android' ? Spacing.three : Spacing.two,
    marginBottom: Spacing.two,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Brand.text,
    fontSize: 22,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
  },
  tripsText: {
    marginTop: 4,
    fontSize: 13,
    color: Brand.textSecondary,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: Spacing.three },
  section: { marginBottom: Spacing.three },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: { backgroundColor: Brand.surface, borderRadius: 14, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 70, gap: 12, paddingHorizontal: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Brand.border },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  copy: { flex: 1 },
  rowTitle: { color: Brand.text, fontSize: 16, fontWeight: '700' },
  rowDetail: { marginTop: 3, color: Brand.textSecondary, fontSize: 13 },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.danger,
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.surface,
  },
  versionText: {
    fontSize: 12,
    color: Brand.muted,
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
});
