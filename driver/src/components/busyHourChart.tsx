import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
  const maxBusy = Math.max(...BUSY_DATA.map((item) => item.busy));

  return (
    <View style={styles.card}>
      <View style={styles.chart}>
        {BUSY_DATA.map((item) => (
          <View key={item.hour} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${(item.busy / maxBusy) * 100}%`,
                    backgroundColor: item.hour === CURRENT_HOUR ? '#3B82F6' : '#CBD5E1',
                  },
                ]}
              />
            </View>
            {/* {item.hour % 4 === 0 ? (
              <Text style={styles.hourLabel}>{formatHour(item.hour)}</Text>
            ) : null} */}
          </View>
        ))}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chart: {
    height: 200,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: 168,
    justifyContent: 'flex-end',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    minHeight: 3,
    borderRadius: 3,
  },
  hourLabel: {
    height: 18,
    marginTop: 5,
    fontSize: 9,
    color: '#94A3B8',
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