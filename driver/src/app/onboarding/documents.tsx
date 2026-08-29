import * as DocumentPicker from 'expo-document-picker';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { DriverDocumentType, getDocumentUploadAuth, submitDocument } from '@/services/driver';

const documentTypes: { type: DriverDocumentType; label: string }[] = [
  { type: 'IDENTITY', label: 'Identity' },
  { type: 'LICENSE', label: 'Driving license' },
  { type: 'INSURANCE', label: 'Insurance' },
  { type: 'VEHICLE_REGISTRATION', label: 'Vehicle registration' },
];

function fileNameFor(type: DriverDocumentType, name?: string | null, mime?: string | null) {
  if (name?.trim()) return name.trim();
  const mimeLower = (mime ?? '').toLowerCase();
  const ext = mimeLower.includes('pdf')
    ? 'pdf'
    : mimeLower.includes('png')
      ? 'png'
      : mimeLower.includes('heic') || mimeLower.includes('heif')
        ? 'heic'
        : 'jpg';
  return `${type.toLowerCase()}.${ext}`;
}

function normalizeMime(mime: string | null | undefined, fileName: string) {
  const lower = (mime ?? '').toLowerCase();
  if (lower === 'image/jpg' || lower === 'image/pjpeg') return 'image/jpeg';
  if (lower) return lower;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function uploadErrorMessage(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON */
  }
  const trimmed = body.trim();
  return trimmed || `Image upload failed (${status})`;
}

export default function DocumentsScreen() {
  const [submitted, setSubmitted] = useState<Partial<Record<DriverDocumentType, true>>>({});
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(null);

  async function choose(type: DriverDocumentType, label: string) {
    if (uploadingType) return;
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    try {
      setUploadingType(type);
      const auth = await getDocumentUploadAuth();
      const fileName = fileNameFor(type, file.name, file.mimeType);
      const mimeType = normalizeMime(file.mimeType, fileName);
      const upload = await uploadAsync('https://upload.imagekit.io/api/v1/files/upload', file.uri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType,
        parameters: {
          fileName,
          publicKey: auth.publicKey,
          token: auth.token,
          expire: String(auth.expire),
          signature: auth.signature,
          folder: auth.folder,
        },
      });
      const uploaded = (() => {
        try {
          return JSON.parse(upload.body) as { fileId?: string; url?: string; message?: string };
        } catch {
          return {} as { fileId?: string; url?: string; message?: string };
        }
      })();
      if (upload.status < 200 || upload.status >= 300 || !uploaded.fileId || !uploaded.url) {
        throw new Error(uploadErrorMessage(upload.body, upload.status));
      }
      await submitDocument({
        type,
        notes: label,
        imageKitFileId: uploaded.fileId,
        fileUrl: uploaded.url,
        fileName,
        mimeType,
        ...(file.size ? { fileSize: file.size } : {}),
      });
      setSubmitted((current) => ({ ...current, [type]: true }));
      Alert.alert('Document submitted', 'Your document is pending admin review.');
    } catch (error: any) {
      Alert.alert(
        'Could not submit document',
        error?.response?.data?.message ?? error?.message ?? 'Try again.',
      );
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Submit clear copies of each required document.</Text>
      {documentTypes.map(({ type, label }) => (
        <ActionButton
          key={type}
          style={styles.row}
          replaceContentOnLoading={false}
          loading={uploadingType === type}
          disabled={uploadingType !== null}
          spinnerColor="#2e4ed2"
          contentStyle={styles.rowContent}
          accessibilityLabel={label}
          onPress={() => void choose(type, label)}
        >
          <Text style={styles.label}>{label}</Text>
          {uploadingType === type ? (
            <View style={styles.uploading}>
              <ActivityIndicator color="#2e4ed2" />
              <Text style={styles.action}>Uploading…</Text>
            </View>
          ) : (
            <Text style={styles.action}>{submitted[type] ? 'Submitted' : 'Choose file'}</Text>
          )}
        </ActionButton>
      ))}
      <Pressable onPress={() => router.back()}><Text style={styles.back}>Done</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: '#f7f8ef' },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, marginBottom: 24, color: '#6B7280' },
  row: { padding: 16, marginBottom: 10, borderRadius: 12, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  rowContent: { justifyContent: 'space-between' },
  label: { flex: 1, color: '#111827', fontWeight: '600', textAlign: 'left' },
  action: { color: '#2e4ed2', fontWeight: '700' },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { marginTop: 18, textAlign: 'center', color: '#2563EB', fontWeight: '600' },
});
