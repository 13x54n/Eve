import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { router, useFocusEffect } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ActionButton } from '@/components/action-button';
import { PullRefresh, usePullToRefresh } from '@/components/pull-refresh';
import { REQUIRED_DOCUMENT_TYPES } from '@/lib/onboarding-steps';
import {
  DriverDocument,
  DriverDocumentType,
  ReviewStatus,
  getDocumentUploadAuth,
  getDriverProfile,
  submitDocument,
} from '@/services/driver';

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

function isPdfDocument(doc: Pick<DriverDocument, 'fileUrl' | 'fileName' | 'mimeType'> | undefined) {
  const mime = (doc?.mimeType ?? '').toLowerCase();
  const name = (doc?.fileName ?? doc?.fileUrl ?? '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf') || name.includes('.pdf?');
}

function statusCopy(status?: ReviewStatus) {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected — re-upload';
  if (status === 'EXPIRED') return 'Expired — re-upload';
  if (status === 'PENDING') return 'Pending review';
  return null;
}

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<Partial<Record<DriverDocumentType, DriverDocument>>>({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [uploadingType, setUploadingType] = useState<DriverDocumentType | null>(null);

  const applyDocuments = useCallback((items: DriverDocument[] | undefined) => {
    const next: Partial<Record<DriverDocumentType, DriverDocument>> = {};
    for (const item of items ?? []) {
      next[item.type] = item;
    }
    setDocuments(next);
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const driver = await getDriverProfile();
      applyDocuments(driver.documents);
    } catch {
      /* keep empty until a file is submitted */
    } finally {
      setLoadingExisting(false);
    }
  }, [applyDocuments]);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
    }, [loadDocuments]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(loadDocuments);

  async function openPreview(url: string) {
    try {
      await openBrowserAsync(url, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
    } catch {
      Alert.alert('Could not open document', 'Try again in a moment.');
    }
  }

  async function choose(type: DriverDocumentType, label: string) {
    if (uploadingType) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
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
      const driver = await submitDocument({
        type,
        notes: label,
        imageKitFileId: uploaded.fileId,
        fileUrl: uploaded.url,
        fileName,
        mimeType,
        ...(file.size ? { fileSize: file.size } : {}),
      });
      applyDocuments(driver.documents);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical
      refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Submit clear copies of each required document.</Text>
      {loadingExisting ? (
        <View style={styles.loadingExisting}>
          <ActivityIndicator color="#2e4ed2" />
          <Text style={styles.loadingExistingText}>Loading existing documents…</Text>
        </View>
      ) : null}
      {REQUIRED_DOCUMENT_TYPES.map(({ type, label }) => {
        const existing = documents[type];
        const previewUrl = existing?.fileUrl?.trim() || null;
        const review = statusCopy(existing?.status);
        const uploading = uploadingType === type;
        return (
          <View key={type} style={styles.card}>
            {previewUrl ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={`Preview ${label}`}
                onPress={() => void openPreview(previewUrl)}
                style={styles.preview}
              >
                {isPdfDocument(existing) ? (
                  <View style={styles.pdfPreview}>
                    <Text style={styles.pdfMark}>PDF</Text>
                  </View>
                ) : (
                  <Image source={{ uri: previewUrl }} style={styles.previewImage} contentFit="cover" />
                )}
              </Pressable>
            ) : (
              <View style={styles.previewPlaceholder} />
            )}
            <View style={styles.cardCopy}>
              <Text style={styles.label}>{label}</Text>
              {review ? (
                <Text
                  style={[
                    styles.status,
                    existing?.status === 'APPROVED' && styles.statusApproved,
                    (existing?.status === 'REJECTED' || existing?.status === 'EXPIRED') && styles.statusRejected,
                  ]}
                >
                  {review}
                </Text>
              ) : null}
            </View>
            <ActionButton
              style={styles.actionButton}
              replaceContentOnLoading={false}
              loading={uploading}
              disabled={uploadingType !== null}
              spinnerColor="#2e4ed2"
              accessibilityLabel={previewUrl ? `Replace ${label}` : `Choose ${label} file`}
              onPress={() => void choose(type, label)}
            >
              {uploading ? (
                <View style={styles.uploading}>
                  <ActivityIndicator color="#2e4ed2" />
                  <Text style={styles.action}>Uploading…</Text>
                </View>
              ) : (
                <Text style={styles.action}>{previewUrl ? 'Replace' : 'Choose file'}</Text>
              )}
            </ActionButton>
          </View>
        );
      })}
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8ef' },
  content: { padding: 24, paddingTop: 70, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 8, marginBottom: 24, color: '#6B7280' },
  loadingExisting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  loadingExistingText: { color: '#6B7280' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  pdfPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  pdfMark: { color: '#2e4ed2', fontWeight: '800', fontSize: 12 },
  cardCopy: { flex: 1, minWidth: 0 },
  label: { color: '#111827', fontWeight: '600' },
  status: { marginTop: 4, color: '#6B7280', fontWeight: '600', fontSize: 12 },
  statusApproved: { color: '#047857' },
  statusRejected: { color: '#B91C1C' },
  actionButton: { paddingVertical: 8, paddingHorizontal: 4 },
  action: { color: '#2e4ed2', fontWeight: '700' },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { marginTop: 18, textAlign: 'center', color: '#2563EB', fontWeight: '600' },
});
