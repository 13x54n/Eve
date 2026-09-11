import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTripMessages, markTripMessagesRead, sendTripMessage, TripMessage } from '@/services/driver';
import { addDriverSocketListener, connectDriverSocket, subscribeTrip } from '@/services/socket';
import { setActiveChatTripId } from '@/services/active-chat';
import { useAuth } from '@/context/auth-context';
import { ActionButton } from '@/components/action-button';

export default function DriverTripChatScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setMessages(await getTripMessages(id));
    } catch {
      /* keep last messages */
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setActiveChatTripId(id);
      void markTripMessagesRead(id);
      return () => setActiveChatTripId(null);
    }, [id]),
  );

  useEffect(() => {
    if (!id) return;
    void connectDriverSocket().then(() => subscribeTrip(id)).catch(() => {});
    void load();
    const remove = addDriverSocketListener((event, payload) => {
      if (!payload || typeof payload !== 'object') return;
      if (event === 'trip:message') {
        const message = payload as TripMessage;
        if (message.tripId !== id) return;
        setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message]));
        if (message.authorId !== user?.id) void markTripMessagesRead(id);
        return;
      }
      if (event === 'trip:messages:read') {
        const body = payload as { tripId?: string; readerId?: string; readAt?: string };
        if (body.tripId !== id || !body.readAt || body.readerId === user?.id) return;
        setMessages((current) =>
          current.map((row) =>
            row.authorId === user?.id && !row.readAt ? { ...row, readAt: body.readAt as string } : row,
          ),
        );
      }
    });
    const timer = setInterval(() => void load(), 4000);
    return () => { remove(); clearInterval(timer); };
  }, [id, load, user?.id]);

  async function send() {
    if (!id || !draft.trim()) return;
    try {
      setSending(true);
      const message = await sendTripMessage(id, draft.trim());
      setDraft('');
      setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message]));
    } catch {
      Alert.alert('Could not send', 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.title}>Chat with rider</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.authorId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
              {mine ? (
                <Text style={styles.status}>{item.readAt ? 'Seen' : 'Sent'}</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Message the rider about pickup.</Text>}
      />
      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Message your rider" />
        <ActionButton
          style={styles.send}
          compact
          loading={sending}
          accessibilityLabel="Send message"
          onPress={() => void send()}
        >
          <Feather name="send" size={16} color="#FFFFFF" />
        </ActionButton>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8EF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  title: { color: '#111827', fontSize: 16, fontWeight: '800' },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { marginTop: 40, color: '#6B7280', textAlign: 'center' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2E4ED5' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF' },
  body: { color: '#111827', fontSize: 14 },
  mineText: { color: '#FFFFFF' },
  status: { marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  composer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF' },
  input: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F3F4F6', color: '#111827' },
  send: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, backgroundColor: '#2E4ED5' },
});
