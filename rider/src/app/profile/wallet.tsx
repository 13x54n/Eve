import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { Brand } from "@/constants/theme";
import { useBrand } from "@/context/theme-context";
import { PullRefresh, usePullToRefresh } from "@/components/pull-refresh";
import { truncateWalletAddress } from "@/lib/privy";
import { getRiderWallet, type RiderWallet, type WalletLedgerEntry } from "@/services/wallet";
import { useCompletePrivySession } from "@/lib/complete-privy-session";

function formatAmount(entry: WalletLedgerEntry) {
  const negative = entry.type === "REFUND" || entry.type === "WALLET_WITHDRAW";
  const value = Math.abs(entry.amount).toFixed(2);
  return `${negative ? "-" : "+"}$${value}`;
}

export default function RiderWalletScreen() {
  const brand = useBrand();
  const completePrivy = useCompletePrivySession();
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setWallet(await getRiderWallet());
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(load);

  async function onReceive() {
    if (!wallet?.ethereumWallet) return;
    await Share.share({ message: wallet.ethereumWallet });
  }

  async function onLink() {
    try {
      setLinking(true);
      await completePrivy();
      await load();
    } catch (error) {
      Alert.alert("Wallet", error instanceof Error ? error.message : "Could not link wallet");
    } finally {
      setLinking(false);
    }
  }

  const onChain = wallet?.onChainUsdc ?? 0;
  const symbol = wallet?.chain.tokenSymbol ?? "USDC";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: brand.canvas }]} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back">
          <Feather name="chevron-left" size={24} color={Brand.ink} />
        </Pressable>
        <Text style={styles.title}>Wallet</Text>
        <Pressable onPress={() => setHidden((value) => !value)}>
          <Feather name={hidden ? "eye-off" : "eye"} size={20} color={Brand.ink} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.hero}>
          <Text style={styles.network}>{wallet?.chain.chainName ?? "Arc Testnet"}</Text>
          <Text style={styles.balance}>{hidden ? "••••" : `${onChain.toFixed(2)} ${symbol}`}</Text>
          <Text style={styles.address}>
            {wallet?.ethereumWallet ? truncateWalletAddress(wallet.ethereumWallet) : "No wallet yet"}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={() => void onReceive()} disabled={!wallet?.ethereumWallet}>
            <Feather name="arrow-down" size={18} color={Brand.accent} />
            <Text style={styles.actionText}>Receive</Text>
          </Pressable>
          {!wallet?.ethereumWallet ? (
            <Pressable style={styles.action} onPress={() => void onLink()} disabled={linking}>
              <Feather name="link" size={18} color={Brand.accent} />
              <Text style={styles.actionText}>{linking ? "Linking" : "Link"}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.token}>
          <Text style={styles.tokenTitle}>{symbol}</Text>
          <Text style={styles.tokenMeta}>Arc Testnet · ERC-20 view</Text>
          <Text style={styles.tokenValue}>{hidden ? "••••" : onChain.toFixed(2)}</Text>
        </View>
        <Text style={styles.section}>Activity</Text>
        {loading ? <ActivityIndicator color={Brand.accent} /> : null}
        {(wallet?.entries ?? []).map((entry) => (
          <View key={entry.id} style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>{entry.note || entry.type}</Text>
              <Text style={styles.rowMeta}>{new Date(entry.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={styles.rowAmount}>{formatAmount(entry)}</Text>
          </View>
        ))}
        {!loading && !(wallet?.entries ?? []).length ? (
          <Text style={styles.empty}>No on-chain activity yet</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: "#2E4ED2", borderRadius: 24, padding: 20 },
  network: { color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  balance: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", marginTop: 12 },
  address: { color: "rgba(255,255,255,0.9)", marginTop: 10, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECEF",
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
  },
  actionText: { color: Brand.accent, fontWeight: "700" },
  token: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, marginTop: 14 },
  tokenTitle: { fontWeight: "700", color: "#0F172A" },
  tokenMeta: { color: "#6B7280", marginTop: 2 },
  tokenValue: { fontWeight: "700", marginTop: 8, color: "#0F172A" },
  section: { fontSize: 17, fontWeight: "700", marginTop: 24, marginBottom: 8, color: "#0F172A" },
  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowTitle: { fontWeight: "600", color: "#0F172A", maxWidth: 220 },
  rowMeta: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  rowAmount: { fontWeight: "700", color: "#16A34A" },
  empty: { color: "#6B7280", marginTop: 8 },
});
