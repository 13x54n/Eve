import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import QRCode from "react-native-qrcode-svg";
import { Camera, CameraView } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { Brand } from "@/constants/theme";
import { useBrand } from "@/context/theme-context";
import { PullRefresh, usePullToRefresh } from "@/components/pull-refresh";
import { truncateWalletAddress } from "@/lib/privy";
import {
  getRiderWallet,
  recordRiderTransfer,
  type RiderWallet,
  type WalletLedgerEntry,
} from "@/services/wallet";
import { useCompletePrivySession } from "@/lib/complete-privy-session";
import { eveArcTestnet, getArcUsdcBalance } from "@/lib/arc-chain";
import { useFundWallet } from "@privy-io/expo/ui";
import { useSendUsdcTransfer } from "@/lib/send-escrow";
import { lightImpact } from "@/lib/haptics";
import { notifyRideEvent } from "@/services/notifications";

function formatAmount(entry: WalletLedgerEntry) {
  const negative = entry.type === "REFUND" || entry.type === "WALLET_WITHDRAW";
  const value = Math.abs(entry.amount).toFixed(2);
  return `${negative ? "-" : "+"}$${value}`;
}

export default function RiderWalletScreen() {
  const brand = useBrand();
  const completePrivy = useCompletePrivySession();
  const sendUsdc = useSendUsdcTransfer();
  const { fundWallet } = useFundWallet();
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showReceiveQR, setShowReceiveQR] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutAddress, setCashOutAddress] = useState("");
  const [cashingOut, setCashingOut] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (!toast || cashingOut) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast, cashingOut]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = await getRiderWallet();
      let onChainUsdc = next.onChainUsdc;
      try {
        onChainUsdc = await getArcUsdcBalance(
          next.ethereumWallet,
          next.chain?.tokenAddress,
          next.chain?.tokenDecimals ?? 6,
        );
      } catch {
        /* keep API value if RPC is unreachable */
      }
      setWallet({ ...next, onChainUsdc });
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


  async function onBuy() {
    if (!wallet?.ethereumWallet) {
      Alert.alert("Buy", "Link your Privy wallet first");
      return;
    }
    const tokenAddress =
      wallet.chain?.tokenAddress || "0x3600000000000000000000000000000000000000";
    try {
      setFunding(true);
      await fundWallet({
        address: wallet.ethereumWallet,
        chain: eveArcTestnet,
        asset: { tokenAddress },
        amount: "20",
        defaultPaymentMethod: "card",
        card: { preferredProvider: "moonpay" },
        moonpay: { useSandbox: true },
      });
      lightImpact();
      setToast("Funding started");
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open funding";
      if (!/cancel|closed|dismiss/i.test(message)) {
        Alert.alert("Buy", message);
      }
    } finally {
      setFunding(false);
    }
  }

  async function onReceive() {
    if (!wallet?.ethereumWallet) return;
    setShowReceiveQR(true);
  }

  async function onShareAddress() {
    if (!wallet?.ethereumWallet) return;
    await Share.share({ message: wallet.ethereumWallet });
  }

  async function onCopyAddress() {
    if (!wallet?.ethereumWallet) return;
    await Clipboard.setStringAsync(wallet.ethereumWallet);
    lightImpact();
    setCopied(true);
    setToast("Address copied");
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

  async function onScanQR() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === "granted");
    if (status === "granted") {
      setShowQRScanner(true);
    } else {
      Alert.alert("Camera", "Camera permission is required to scan QR codes");
    }
  }

  function onQRScanned(data: string) {
    setShowQRScanner(false);
    if (/^0x[a-fA-F0-9]{40}$/.test(data)) {
      setCashOutAddress(data);
      setShowCashOut(true);
    } else {
      Alert.alert("Invalid QR", "The scanned QR code is not a valid Ethereum address");
    }
  }

  async function onCashOut() {
    const amount = Number(cashOutAmount);
    const address = cashOutAddress.trim();

    if (!Number.isFinite(amount) || amount < 1) {
      Alert.alert("Cash out", "Enter at least $1.00");
      return;
    }

    if (!address && !wallet?.ethereumWallet) {
      Alert.alert("Cash out", "Enter a wallet address or link your Privy wallet");
      return;
    }

    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      Alert.alert("Cash out", "Enter a valid Ethereum address");
      return;
    }

    if (amount > (wallet?.onChainUsdc ?? 0)) {
      Alert.alert("Cash out", "Amount exceeds your on-chain USDC balance");
      return;
    }

    const destination = address || wallet?.ethereumWallet;
    const tokenAddress = wallet?.chain.tokenAddress;
    if (!destination || !tokenAddress) {
      Alert.alert("Cash out", "Link a Privy wallet before cashing out");
      return;
    }

    try {
      setCashingOut(true);
      setToast(`Sending ${amount.toFixed(2)} USDC…`);
      const hash = await sendUsdc({
        to: destination,
        amountUsd: amount,
        tokenAddress,
        chainId: wallet.chain.chainId,
        decimals: wallet.chain.tokenDecimals ?? 6,
      });
      try {
        await recordRiderTransfer(amount, hash, destination);
      } catch {
        /* chain send already succeeded */
      }
      lightImpact();
      setCashOutAmount("");
      setCashOutAddress("");
      setShowCashOut(false);
      await load();
      setToast(`Sent ${amount.toFixed(2)} USDC`);
      void notifyRideEvent("USDC sent", `${amount.toFixed(2)} USDC sent on Arc Testnet`, { screen: "wallet" });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (error instanceof Error ? error.message : "Cash-out failed");
      setToast("Cash-out failed");
      void notifyRideEvent("Cash-out failed", message, { screen: "wallet" });
      Alert.alert("Cash out", message);
    } finally {
      setCashingOut(false);
    }
  }

  const onChain = wallet?.onChainUsdc ?? 0;
  const symbol = wallet?.chain.tokenSymbol ?? "USDC";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: brand.canvas }]} edges={["top"]}>
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <Modal
        visible={showReceiveQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiveQR(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowReceiveQR(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive {symbol}</Text>
              <Pressable onPress={() => setShowReceiveQR(false)} accessibilityLabel="Close">
                <Feather name="x" size={24} color={Brand.ink} />
              </Pressable>
            </View>
            <View style={styles.qrContainer}>
              {wallet?.ethereumWallet ? (
                <QRCode value={wallet.ethereumWallet} size={220} />
              ) : null}
            </View>
            <Text style={styles.qrAddress}>{wallet?.ethereumWallet}</Text>
            <View style={styles.receiveActions}>
              <Pressable style={styles.shareButton} onPress={() => void onCopyAddress()}>
                <Feather name="copy" size={18} color={Brand.accent} />
                <Text style={styles.shareButtonText}>{copied ? "Copied" : "Copy address"}</Text>
              </Pressable>
              <Pressable style={styles.shareButton} onPress={() => void onShareAddress()}>
                <Feather name="share" size={18} color={Brand.accent} />
                <Text style={styles.shareButtonText}>Share address</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showCashOut}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!cashingOut) setShowCashOut(false); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { if (!cashingOut) setShowCashOut(false); }}>
          <View style={styles.cashOutContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cash out</Text>
              <Pressable onPress={() => { if (!cashingOut) setShowCashOut(false); }} accessibilityLabel="Close" disabled={cashingOut}>
                <Feather name="x" size={24} color={Brand.ink} />
              </Pressable>
            </View>
            <Text style={styles.inputLabel}>Amount (USD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={cashOutAmount}
              onChangeText={setCashOutAmount}
              editable={!cashingOut}
            />
            <Text style={styles.inputLabel}>Destination address (optional)</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder={wallet?.ethereumWallet ? "Your wallet" : "0x..."}
                value={cashOutAddress}
                onChangeText={setCashOutAddress}
                editable={!cashingOut}
              />
              <Pressable style={styles.scanButton} onPress={() => void onScanQR()} disabled={cashingOut}>
                <Feather name="maximize" size={18} color={Brand.accent} />
              </Pressable>
            </View>
            <Pressable
              style={[styles.cashOutConfirm, cashingOut && styles.cashOutConfirmDisabled]}
              onPress={() => void onCashOut()}
              disabled={cashingOut}
            >
              {cashingOut ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.cashOutConfirmText}>{cashingOut ? "Sending…" : "Confirm"}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showQRScanner} animationType="slide" onRequestClose={() => setShowQRScanner(false)}>
        <View style={styles.scannerContainer}>
          {hasPermission ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={(result) => {
                if (result.data) {
                  onQRScanned(result.data);
                }
              }}
            />
          ) : (
            <View style={styles.scannerPlaceholder}>
              <Text style={styles.scannerText}>No camera permission</Text>
            </View>
          )}
          <Pressable style={styles.scannerClose} onPress={() => setShowQRScanner(false)}>
            <Feather name="x" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>

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
          <Pressable
            style={styles.action}
            onPress={() => void onBuy()}
            disabled={!wallet?.ethereumWallet || funding}
          >
            <Feather name="plus-circle" size={18} color={Brand.accent} />
            <Text style={styles.actionText}>{funding ? "Buying…" : "Buy"}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => void onReceive()} disabled={!wallet?.ethereumWallet}>
            <Feather name="arrow-down" size={18} color={Brand.accent} />
            <Text style={styles.actionText}>Receive</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => setShowCashOut(true)}>
            <Feather name="arrow-up" size={18} color={Brand.accent} />
            <Text style={styles.actionText}>Cash out</Text>
          </Pressable>
          {!wallet?.ethereumWallet ? (
            <Pressable style={styles.action} onPress={() => void onLink()} disabled={linking}>
              <Feather name="link" size={18} color={Brand.accent} />
              <Text style={styles.actionText}>{linking ? "Linking" : "Link"}</Text>
            </Pressable>
          ) : null}
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
  safe: { flex: 1, position: "relative" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  qrContainer: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EAECEF",
  },
  qrAddress: {
    marginTop: 16,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  receiveActions: {
    width: "100%",
    marginTop: 4,
  },
  toast: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  shareButtonText: {
    color: Brand.accent,
    fontWeight: "600",
    fontSize: 15,
  },
  cashOutContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxWidth: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECEF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0F172A",
  },
  addressRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  scanButton: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#EAECEF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cashOutConfirm: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  cashOutConfirmDisabled: {
    opacity: 0.5,
  },
  cashOutConfirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scannerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scannerText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  scannerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
});
