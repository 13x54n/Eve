import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getSupportTicket, sendSupportMessage, SupportMessage, SupportTicket } from "@/services/support";
import { addSocketListener } from "@/services/socket";
import { useAuth } from "@/context/auth-context";
import { ActionButton } from "@/components/action-button";

export default function SupportThreadScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTicket(await getSupportTicket(id));
    } catch {
      /* keep last */
    }
  }, [id]);

  useEffect(() => {
    void load();
    const remove = addSocketListener((event) => {
      if (event === "support:message") void load();
    });
    const timer = setInterval(() => void load(), 5000);
    return () => { remove(); clearInterval(timer); };
  }, [load]);

  async function send() {
    if (!id || !draft.trim()) return;
    try {
      setSending(true);
      setTicket(await sendSupportMessage(id, draft.trim()));
      setDraft("");
    } catch {
      Alert.alert("Could not send", "Please try again.");
    } finally {
      setSending(false);
    }
  }

  const messages: SupportMessage[] = ticket?.messages ?? [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.title}>{ticket?.subject ?? "Support"}</Text>
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
      />
      <View style={[styles.composer, { paddingBottom: Math.max(12, insets.bottom) }]}>
        <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="Reply to support" />
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
  container: { flex: 1, backgroundColor: "#F7F8EF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 16 },
  mine: { alignSelf: "flex-end", backgroundColor: "#2E4ED5" },
  theirs: { alignSelf: "flex-start", backgroundColor: "#FFFFFF" },
  body: { color: "#111827", fontSize: 14 },
  mineText: { color: "#FFFFFF" },
  composer: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#FFFFFF" },
  input: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6", color: "#111827" },
  send: { alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, backgroundColor: "#2E4ED5" },
});
