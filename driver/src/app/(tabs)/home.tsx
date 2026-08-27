import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BusyHoursChart from '@/components/busyHourChart';
import { Image } from 'expo-image';

// npm install react-native-maps @expo/vector-icons expo-image
// Native map — requires a custom dev client (won't run in plain Expo Go):
//   npx expo install react-native-maps
//   npx expo prebuild
//   npx expo run:ios      (or: npx expo run:android)
// Tiles are OpenStreetMap via UrlTile, no API key needed.
// OSM's free tile server has usage limits — swap the urlTemplate for a paid
// provider (MapTiler, Stadia Maps, etc.) before shipping to production.

const HELSINKI_REGION = {
  latitude: 60.1699,
  longitude: 24.9384,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function Home() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Image
            source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }}
            style={{ width: 40, height: 40, marginRight: 'auto' }}
          />
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="shield-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Section: Your Progress */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ready to go?</Text>
        </View>

        {/* Map */}
        <View style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFillObject}
              initialRegion={HELSINKI_REGION}
              showsUserLocation={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
            </MapView>

            {/* Demand heat circle */}
            <View pointerEvents="none" style={styles.heatCircle} />

            {/* Current location marker */}
            <View pointerEvents="none" style={styles.locationDotOuter}>
              <View style={styles.locationDotInner} />
            </View>

            {/* Recenter button */}
            <TouchableOpacity
              style={styles.recenterButton}
              activeOpacity={0.65}
            >
              <Ionicons name="locate" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Earnings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <Text style={styles.sectionSubtitle}>
            Earning trends for drivers in your current area
          </Text>
          <Text style={styles.sectionBody}>
            Explore the best times and places to deliver today.
          </Text>
        </View>

        <BusyHoursChart />

        {/* Spacer so content isn't hidden behind the fixed button */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Fixed "Go Online" button — pinned above the bottom tab bar.
          Sits outside the ScrollView so it stays put while scrolling.
          Because this screen's content area is already sized to end where
          the tab navigator's tab bar begins, position: 'absolute' + bottom: 0
          here places it directly above the tabs without covering them. */}
      <View style={styles.goOnlineWrapper} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.goOnlineButton}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="car" size={20} color="#FFFFFF" />
          <Text style={styles.goOnlineText}>Go Online</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // --- Top bar ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#EAECEF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // --- Section headers / text ---
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
  },

  // --- Map ---
  mapCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#ECEFF1',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mapContainer: {
    height: 360,
    overflow: 'hidden',
  },
  heatCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    marginTop: -150,
    borderRadius: 150,
    backgroundColor: 'rgba(180,180,190,0.35)',
  },
  locationDotOuter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  locationDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  // --- Fixed Go Online button ---
  goOnlineWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    // backgroundColor: 'rgba(255,255,255,0.96)',
    // borderTopWidth: 1,
    // borderTopColor: '#F0F0F0',
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2e4ed2',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  goOnlineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});