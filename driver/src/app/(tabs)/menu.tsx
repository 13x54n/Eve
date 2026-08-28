import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { getDriverProfile } from '@/services/driver';
import { useAuth } from '@/context/auth-context';

// npm install @expo/vector-icons expo-image
// No dev client needed — everything here works in plain Expo Go.

type MenuItem = {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

function iconWrap(bg: string, child: React.ReactNode) {
  return <View style={[styles.rowIcon, { backgroundColor: bg }]}>{child}</View>;
}

export default function MenuScreen() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    void getDriverProfile().then((driver) => { if (mounted) setProfile(driver); }).catch(() => { /* keep placeholder state */ });
    return () => { mounted = false; };
  }, []);

  const vehicle = profile?.vehicles?.[0];
  const vehicleSublabel = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`
    : 'Add your vehicle details';
  const personalInfoSublabel = profile?.user
    ? [profile.user.name, profile.user.phone].filter(Boolean).join(' · ')
    : 'Name, phone, email';

  // Swap for your real navigation/auth logic.
  const goTo = (screen: string) => () => {
    if (screen === 'VehicleManagement') {
      router.push('/onboarding/vehicle' as Href);
    } else if (screen === 'Documents') {
      router.push('/onboarding/documents' as Href);
    } else if (screen === 'Legal') {
      router.push('/legal' as Href);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/(auth)/welcome'));
        },
      },
    ]);
  };

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: iconWrap(
            '#F0FDF4',
            <MaterialCommunityIcons name="car-side" size={18} color="#16A34A" />
          ),
          label: 'Vehicle management',
          sublabel: vehicleSublabel,
          onPress: goTo('VehicleManagement'),
        },
        {
          icon: iconWrap(
            '#FFFBEB',
            <Feather name="file-text" size={17} color="#D97706" />
          ),
          label: 'Documents',
          sublabel: 'License, insurance, background check',
          onPress: goTo('Documents'),
        },
      ],
    },
    {
      title: 'Resources',
      items: [
        {
          icon: iconWrap(
            '#EFF6FF',
            <Ionicons name="help-buoy-outline" size={18} color="#3B82F6" />
          ),
          label: 'Support',
          onPress: goTo('HelpCenter'),
        },
        // {
        //   icon: iconWrap(
        //     '#FEF2F2',
        //     <Ionicons name="shield-checkmark-outline" size={18} color="#DC2626" />
        //   ),
        //   label: 'Safety toolkit',
        //   onPress: goTo('Safety'),
        // },
        // {
        //   icon: iconWrap(
        //     '#F0FDF4',
        //     <Ionicons name="people-outline" size={18} color="#16A34A" />
        //   ),
        //   label: 'Community guidelines',
        //   onPress: goTo('Community'),
        // },
        {
          icon: iconWrap(
            '#F8FAFC',
            <Feather name="file" size={17} color="#64748B" />
          ),
          label: 'Terms & privacy',
          onPress: goTo('Legal'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: iconWrap(
            '#EFF6FF',
            <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
          ),
          label: 'Notifications',
          onPress: goTo('Notifications'),
        },
        // {
        //   icon: iconWrap(
        //     '#F8FAFC',
        //     <Ionicons name="settings-outline" size={18} color="#64748B" />
        //   ),
        //   label: 'App settings',
        //   onPress: goTo('Settings'),
        // },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Menu</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.75}
          onPress={goTo('Profile')}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/vector-1755257875851-08e44758a35b?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.user?.name ?? 'Loading...'}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.ratingText}>{profile?.rating ? Number(profile.rating).toFixed(2) : '—'}</Text>
              <View style={styles.dot} />
              <Text style={styles.tripsText}>{profile?.city ?? 'No city set'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7CAD1" />
        </TouchableOpacity>

        {/* Menu sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.6}
                    onPress={item.onPress}
                  >
                    {item.icon}
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowLabel}>{item.label}</Text>
                      {item.sublabel ? (
                        <Text style={styles.rowSublabel}>{item.sublabel}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#C7CAD1" />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && (
                    <View style={styles.rowSeparator} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.7}
          onPress={handleSignOut}
        >
          <Feather name="log-out" size={17} color="#ffffff" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Eve Driver · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 8,
  },
  topBarTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // --- Profile ---
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    
    marginTop: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#C7CAD1',
    marginHorizontal: 4,
  },
  tripsText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },

  // --- Sections ---
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,

  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    // paddingHorizontal: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  rowSublabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 2,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: '#F1F2ED',
    marginLeft: 62,
  },

  // --- Sign out ---
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'red',
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#FCE7E7',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#B0B3AC',
    textAlign: 'center',
    marginTop: 16,
  },
});