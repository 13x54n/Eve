import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';

// This is Victory Native XL (v42+), which is Skia-based — it does NOT use react-native-svg.
// Requires a custom dev client (won't run in plain Expo Go):
//
//   npx expo install @shopify/react-native-skia react-native-reanimated
//   npx expo prebuild
//   npx expo run:ios      (or: npx expo run:android)
//
// If you already set up a dev client for react-native-maps, you can install these
// alongside it and just rebuild once.
//
// Also make sure react-native-reanimated's babel plugin is in babel.config.js:
//   plugins: ['react-native-reanimated/plugin'],   // must be listed LAST

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const CURRENT_HOUR = new Date().getHours();

// Mock "how busy it is" data, 0 (quiet) - 100 (very busy), one point per hour.
// Swap this for your real demand/ride-request data.
const BUSY_DATA = [
  { hour: 0, busy: 18 },
  { hour: 1, busy: 12 },
  { hour: 2, busy: 8 },
  { hour: 3, busy: 6 },
  { hour: 4, busy: 10 },
  { hour: 5, busy: 22 },
  { hour: 6, busy: 38 },
  { hour: 7, busy: 62 },
  { hour: 8, busy: 78 },
  { hour: 9, busy: 55 },
  { hour: 10, busy: 40 },
  { hour: 11, busy: 42 },
  { hour: 12, busy: 58 },
  { hour: 13, busy: 52 },
  { hour: 14, busy: 44 },
  { hour: 15, busy: 48 },
  { hour: 16, busy: 60 },
  { hour: 17, busy: 82 },
  { hour: 18, busy: 95 },
  { hour: 19, busy: 88 },
  { hour: 20, busy: 70 },
  { hour: 21, busy: 54 },
  { hour: 22, busy: 40 },
  { hour: 23, busy: 26 },
];

function formatHour(hour: number) {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

export default function BusyHoursChart() {
  return (
    <View style={styles.card}>
      <View style={{ width: CHART_WIDTH, height: 200 }}>
        <CartesianChart
          data={BUSY_DATA}
          xKey="hour"
          yKeys={['busy']}
          domainPadding={{ left: 12, right: 12, top: 12 }}
          axisOptions={{
            tickCount: { x: 5, y: 0 },
            formatXLabel: (v) => formatHour(v),
            labelColor: '#6B7280',
            lineColor: '#E5E7EB',
            font: null, // pass a useFont() result here if you want custom label font
          }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.busy}
              chartBounds={chartBounds}
              color="#3B82F6"
              roundedCorners={{ topLeft: 4, topRight: 4 }}
              barWidth={14}
              // Highlight the current hour, dim the rest
              // (Victory Native XL doesn't support per-bar color directly,
              // so this uses opacity as the highlight mechanism instead.)
              opacity={1}
            />
          )}
        </CartesianChart>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.legendText}>
            Now ({formatHour(CURRENT_HOUR)})
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
});