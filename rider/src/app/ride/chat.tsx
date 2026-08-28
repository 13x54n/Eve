import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTripMessages, sendTripMessage, TripMessage } from "@/services/trips";
import { addSocketListener, connectSocket, subscribeTrip } from "@/services/socket";
import { useAuth } from "@/context/auth-context";

export default function TripChatScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      setMessages(await getTripMessages(tripId));
    } catch {
      /* keep last messages */
    }
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    void connectSocket().then(() => subscribeTrip(tripId)).catch(() => {});
    void load();
    const remove = addSocketListener((event, payload) => {
      if (event !== "trip:message" || !payload || typeof payload !== "object") return;
      const message = payload as TripMessage;
      if (message.tripId !== tripId) return;
      setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message]));
    });
    const timer = setInterval(() => void load(), 4000);
    return () => { remove(); clearInterval(timer); };
  }, [load, tripId]);

  async function send() {
    if (!tripId || !draft.trim()) return;
    try {
      setSending(true);
      const message = await sendTripMessage(tripId, draft.trim());
      setDraft("");
      setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message]));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert("Could not send", message ?? "Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.title}>Chat with driver</Text>
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
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Say hello so your driver knows you’re ready.</Text>}
      />
      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your driver"
          maxLength={1000}
        />
        <Pressable style={styles.send} onPress={() => void send()} disabled={sending}>
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="send" size={16} color="#FFFFFF" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8EF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 16, fontWeight: "800" },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { marginTop: 40, color: "#6B7280", textAlign: "center" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  mine: { alignSelf: "flex-end", backgroundColor: "#2E4ED5" },
  theirs: { alignSelf: "flex-start", backgroundColor: "#FFFFFF" },
  body: { color: "#111827", fontSize: 14 },
  mineText: { color: "#FFFFFF" },
  composer: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#FFFFFF" },
  input: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6", color: "#111827" },
  send: { alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, backgroundColor: "#2E4ED5" },
});
