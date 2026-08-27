import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { saveVehicle, VehicleType } from '@/services/driver';

export default function VehicleScreen() {
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2022');
  const [color, setColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!make.trim() || !model.trim() || !color.trim() || !plateNumber.trim()) {
      Alert.alert('Missing details', 'Complete every vehicle field before saving.');
      return;
    }

    try {
      setLoading(true);
      await saveVehicle({
        make: make.trim(),
        model: model.trim(),
        year: Number(year),
        color: color.trim(),
        plateNumber: plateNumber.trim(),
        vehicleType,
        capacity: vehicleType === 'BIKE' ? 1 : 4,
      });
      Alert.alert('Vehicle saved', 'Your vehicle details are pending admin review.');
      router.back();
    } catch (error: any) {
      Alert.alert('Could not save vehicle', error.response?.data?.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vehicle details</Text>
      <Text style={styles.subtitle}>Keep these details current for admin review.</Text>
      <View style={styles.typeRow}>
        {(['CAR', 'BIKE'] as VehicleType[]).map((type) => (
          <Pressable key={type} style={[styles.type, vehicleType === type && styles.active]} onPress={() => setVehicleType(type)}>
            <Text style={vehicleType === type ? styles.activeText : styles.typeText}>{type === 'CAR' ? 'Car' : 'Bike'}</Text>
          </Pressable>
        ))}
      </View>
      {[
        ['Make', make, setMake], ['Model', model, setModel], ['Year', year, setYear],
        ['Color', color, setColor], ['License plate', plateNumber, setPlateNumber],
      ].map(([label, value, setter]) => (
        <TextInput key={label as string} style={styles.input} placeholder={label as string} value={value as string} onChangeText={setter as (value: string) => void} />
      ))}
      <Pressable style={styles.button} onPress={() => void submit()} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save vehicle'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: '#f7f8ef' },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, marginBottom: 24, color: '#6B7280' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  type: { flex: 1, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, backgroundColor: 'white' },
  active: { borderColor: '#2e4ed2', backgroundColor: '#EEF2FF' },
  typeText: { color: '#374151', fontWeight: '600' },
  activeText: { color: '#2e4ed2', fontWeight: '700' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 14, marginBottom: 12 },
  button: { backgroundColor: '#2e4ed2', padding: 16, borderRadius: 12, marginTop: 8 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '700' },
});