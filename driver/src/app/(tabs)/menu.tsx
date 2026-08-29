import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host, FieldGroup, ListItem } from '@expo/ui';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect, type Href } from 'expo-router';
import { getDriverProfile } from '@/services/driver';
import { useAuth } from '@/context/auth-context';
import { Brand, Spacing } from '@/constants/theme';
import { useBrand } from '@/context/theme-context';
import { lightImpact } from '@/lib/haptics';
import { ActionButton } from '@/components/action-button';

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: brand.canvas }]} edges={['top']}>
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
      <View style={{ flex: 1 }}>
      <Host matchContents>
        <FieldGroup>
          <FieldGroup.Section title="Account">
            <ListItem
              supportingText={personalInfoSublabel}
              leading={<SymbolView name="person.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/profile/edit' as Href)}
            >
              Personal information
            </ListItem>
            <ListItem
              supportingText={vehicleSublabel}
              leading={<SymbolView name="car.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/onboarding/vehicle' as Href)}
            >
              Vehicle management
            </ListItem>
            <ListItem
              supportingText="License, insurance, background check"
              leading={<SymbolView name="doc.text.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/onboarding/documents' as Href)}
            >
              Documents
            </ListItem>
          </FieldGroup.Section>
          <FieldGroup.Section title="Resources">
            <ListItem
              leading={<SymbolView name="lifepreserver" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/trip/support' as Href)}
            >
              Support
            </ListItem>
            <ListItem
              leading={<SymbolView name="doc.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/legal' as Href)}
            >
              Terms & privacy
            </ListItem>
          </FieldGroup.Section>
          <FieldGroup.Section title="Preferences">
            <ListItem
              supportingText="Ride updates and appearance"
              leading={<SymbolView name="bell.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/profile/notifications' as Href)}
            >
              Notifications & appearance
            </ListItem>
            <ListItem
              supportingText="Password"
              leading={<SymbolView name="lock.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push('/profile/security' as Href)}
            >
              Security
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
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
