import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSupportTicket, listSupportTickets, SupportTicket } from '@/services/support';
import { ActionButton } from '@/components/action-button';

export default function DriverSupportListScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState(tripId ? 'Help with my trip' : 'Help with Eve');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await listSupportTickets());
    } catch {
      /* keep last list */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startTicket() {
    if (!body.trim()) {
      Alert.alert('Add a message', 'Tell us what you need help with.');
      return;
    }
    try {
      setSending(true);
      const ticket = await createSupportTicket({
        subject: subject.trim() || 'Help',
        category: tripId ? 'TRIP' : 'GENERAL',
        body: body.trim(),
        tripId,
      });
      setBody('');
      router.push({ pathname: '/trip/support/[id]', params: { id: ticket.id } });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert('Could not start chat', message ?? 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.title}>Help and support</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.section}>New message</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" />
      <TextInput
        style={[styles.input, styles.area]}
        value={body}
        onChangeText={setBody}
        placeholder="Describe what happened"
        multiline
      />
      <ActionButton
        style={styles.button}
        textStyle={styles.buttonText}
        label="Start support chat"
        loadingLabel="Sending..."
        loading={sending}
        onPress={() => void startTicket()}
      />
      <Text style={styles.section}>Your tickets</Text>
      {tickets.length === 0 ? <Text style={styles.empty}>No support chats yet.</Text> : null}
      {tickets.map((ticket) => (
        <Pressable
          key={ticket.id}
          style={styles.ticket}
          onPress={() => router.push({ pathname: '/trip/support/[id]', params: { id: ticket.id } })}
        >
          <View style={styles.ticketCopy}>
            <Text style={styles.ticketTitle}>{ticket.subject}</Text>
            <Text style={styles.ticketMeta}>{ticket.status} · {ticket.category}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#F7F8EF', flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { color: '#111827', fontSize: 16, fontWeight: '800' },
  section: { marginTop: 8, marginBottom: 10, color: '#374151', fontWeight: '700' },
  input: { marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF', color: '#111827' },
  area: { minHeight: 90, textAlignVertical: 'top' },
  button: { alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#2E4ED5', marginBottom: 24 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  empty: { color: '#6B7280' },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  ticketCopy: { flex: 1 },
  ticketTitle: { color: '#111827', fontWeight: '700' },
  ticketMeta: { marginTop: 4, color: '#6B7280', fontSize: 12 },
});
