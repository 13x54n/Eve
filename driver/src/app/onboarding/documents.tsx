import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DriverDocumentType, getDocumentUploadAuth, submitDocument } from '@/services/driver';

const documentTypes: { type: DriverDocumentType; label: string }[] = [
  { type: 'IDENTITY', label: 'Identity' },
  { type: 'LICENSE', label: 'Driving license' },
  { type: 'INSURANCE', label: 'Insurance' },
  { type: 'VEHICLE_REGISTRATION', label: 'Vehicle registration' },
];

export default function DocumentsScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function choose(type: DriverDocumentType, label: string) {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    try {
      setLoading(true);
      setSelected(type);
      const auth = await getDocumentUploadAuth();
      const body = new FormData();
      body.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as any);
      body.append('fileName', file.name);
      body.append('publicKey', auth.publicKey);
      body.append('token', auth.token);
      body.append('expire', String(auth.expire));
      body.append('signature', auth.signature);
      body.append('folder', auth.folder);
      const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok || !uploaded.fileId || !uploaded.url) {
        throw new Error('Image upload failed');
      }
      await submitDocument({
        type,
        notes: label,
        imageKitFileId: uploaded.fileId,
        fileUrl: uploaded.url,
        fileName: file.name,
        mimeType: file.mimeType,
        fileSize: file.size,
      });
      Alert.alert('Document submitted', 'Your document is pending admin review.');
    } catch (error: any) {
      Alert.alert('Could not submit document', error.response?.data?.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Submit clear copies of each required document.</Text>
      {documentTypes.map(({ type, label }) => (
        <Pressable key={type} style={styles.row} onPress={() => void choose(type, label)} disabled={loading}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.action}>{selected === type ? 'Submitted' : 'Choose file'}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => router.back()}><Text style={styles.back}>Done</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: '#f7f8ef' },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, marginBottom: 24, color: '#6B7280' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 10, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  label: { color: '#111827', fontWeight: '600' },
  action: { color: '#2e4ed2', fontWeight: '700' },
  back: { marginTop: 18, textAlign: 'center', color: '#2563EB', fontWeight: '600' },
});