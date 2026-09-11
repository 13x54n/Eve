import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  executeSwap,
  getSwapHistory,
  getSwapQuote,
  getSwapStatus,
  getSwapWallet,
  getWallet,
  type SupportedSwapToken,
  type SwapQuoteResult,
  type SwapRecord,
  type SwapWallet,
} from '@/services/driver';
import { selectionImpact } from '@/lib/haptics';

const SWAP_TOKENS: readonly { symbol: SupportedSwapToken; name: string }[] = [
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'EURC', name: 'Euro Coin' },
  { symbol: 'cirBTC', name: 'Circle BTC' },
] as const;

export default function SwapScreen() {
  const router = useRouter();

  const [wallet, setWallet] = useState<SwapWallet | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Swap Form state
  const [tokenIn, setTokenIn] = useState<SupportedSwapToken>('USDC');
  const [tokenOut, setTokenOut] = useState<SupportedSwapToken>('EURC');
  const [payAmount, setPayAmount] = useState('10');
  const [quote, setQuote] = useState<SwapQuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Execution state
  const [swapping, setSwapping] = useState(false);
  const [swapStatusText, setSwapStatusText] = useState<string | null>(null);
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Success modal
  const [completedSwap, setCompletedSwap] = useState<SwapRecord | null>(null);

  const presets = useMemo(() => {
    if (tokenIn === 'cirBTC') {
      return ['0.001', '0.005', '0.01'];
    }
    return ['10', '50', '100'];
  }, [tokenIn]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const [driverWalletRes, swapWalletRes] = await Promise.allSettled([
        getWallet(),
        getSwapWallet(),
      ]);

      const dw = driverWalletRes.status === 'fulfilled' ? driverWalletRes.value : null;
      const sw = swapWalletRes.status === 'fulfilled' ? swapWalletRes.value : null;

      const activeAddress = dw?.ethereumWallet || sw?.address;
      const walletId = dw?.ethereumWalletId || sw?.id || 'driver_wallet';

      if (activeAddress) {
        const resolvedWallet: SwapWallet = {
          id: walletId,
          address: activeAddress,
          chainType: 'ethereum',
          ownerPublicKey: sw?.ownerPublicKey || '',
          gasSponsored: sw?.gasSponsored ?? true,
          status: 'active',
          createdAt: sw?.createdAt || new Date().toISOString(),
          testnets: [
            {
              caip2: 'eip155:5042002',
              chainId: 5042002,
              name: 'Arc Testnet',
              currencySymbol: 'USDC',
              explorerUrl: 'https://testnet.arcscan.app',
              defaultDestinationToken: '0x3600000000000000000000000000000000000000',
              defaultDestinationSymbol: 'USDC',
            },
          ],
        };
        setWallet(resolvedWallet);
      } else {
        Alert.alert('Wallet Notice', 'Please log in with or link your wallet before swapping.');
      }
    } catch (err: any) {
      console.error('[Swap] Failed to load wallet:', err);
      Alert.alert('Wallet Error', err?.response?.data?.message || err?.message || 'Could not load wallet.');
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const list = await getSwapHistory();
      setHistory(list);
    } catch (err) {
      console.warn('[Swap] Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
    void loadHistory();
  }, [loadInitialData, loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInitialData(), loadHistory()]);
    setRefreshing(false);
  }, [loadInitialData, loadHistory]);

  // Debounced quote fetch
  useEffect(() => {
    const numeric = parseFloat(payAmount);
    if (!payAmount || isNaN(numeric) || numeric <= 0 || tokenIn === tokenOut) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setLoadingQuote(true);
        setQuoteError(null);
        const q = await getSwapQuote({
          chain: 'Arc_Testnet',
          tokenIn,
          tokenOut,
          amountIn: payAmount,
          baseAmount: payAmount,
          sourceSymbol: tokenIn,
          destinationSymbol: tokenOut,
          slippageBps: 50,
        });
        if (isMounted) {
          setQuote(q);
        }
      } catch (err: any) {
        if (isMounted) {
          const msg = err?.response?.data?.message || err?.message || 'Failed to fetch quote';
          setQuoteError(msg);
          setQuote(null);
        }
      } finally {
        if (isMounted) setLoadingQuote(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [payAmount, tokenIn, tokenOut]);

  const onFlipDirection = () => {
    void selectionImpact();
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    if (tokenOut === 'cirBTC' && parseFloat(payAmount) >= 1) {
      setPayAmount('0.005');
    } else if (tokenIn === 'cirBTC' && parseFloat(payAmount) < 1) {
      setPayAmount('10');
    }
  };

  const onSelectTokenIn = (token: SupportedSwapToken) => {
    void selectionImpact();
    if (token === tokenOut) {
      setTokenOut(tokenIn);
    }
    setTokenIn(token);
    if (token === 'cirBTC' && parseFloat(payAmount) >= 1) {
      setPayAmount('0.005');
    } else if (token !== 'cirBTC' && parseFloat(payAmount) < 1) {
      setPayAmount('10');
    }
  };

  const onSelectTokenOut = (token: SupportedSwapToken) => {
    void selectionImpact();
    if (token === tokenIn) {
      setTokenIn(tokenOut);
    }
    setTokenOut(token);
  };

  const onCopyAddress = async () => {
    if (wallet?.address) {
      await Clipboard.setStringAsync(wallet.address);
      void selectionImpact();
      Alert.alert('Copied', 'Wallet address copied to clipboard.');
    }
  };

  const handleExecuteSwap = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0 || tokenIn === tokenOut) return;

    void selectionImpact();
    setSwapping(true);
    setSwapStatusText('Submitting swap via App Kit SDK...');

    try {
      const { actionId, swap } = await executeSwap({
        chain: 'Arc_Testnet',
        tokenIn,
        tokenOut,
        amountIn: payAmount,
        baseAmount: payAmount,
        sourceSymbol: tokenIn,
        destinationSymbol: tokenOut,
        slippageBps: 50,
      });

      if (swap.status === 'succeeded') {
        setCompletedSwap(swap);
        setSwapping(false);
        setSwapStatusText(null);
        void loadHistory();
        return;
      }

      setSwapStatusText('Confirming on Arc Testnet...');

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const check = await getSwapStatus(actionId);
          if (check.status === 'succeeded' || check.status === 'failed' || attempts > 15) {
            clearInterval(interval);
            setSwapping(false);
            setSwapStatusText(null);
            void loadHistory();

            if (check.status === 'succeeded') {
              setCompletedSwap(check.swap || swap);
            } else {
              Alert.alert('Swap Failed', 'The swap could not be completed on-chain.');
            }
          }
        } catch {
          if (attempts > 15) {
            clearInterval(interval);
            setSwapping(false);
            setSwapStatusText(null);
            void loadHistory();
          }
        }
      }, 1500);
    } catch (err: any) {
      setSwapping(false);
      setSwapStatusText(null);
      const msg = err?.response?.data?.message || err?.message || 'Failed to execute swap';
      Alert.alert('Swap Error', msg);
    }
  };

  const rateText = useMemo(() => {
    if (!quote || !quote.estOutputAmount || !payAmount) return null;
    const inVal = parseFloat(payAmount);
    const outVal = parseFloat(quote.estOutputAmount);
    if (inVal <= 0 || outVal <= 0) return null;
    const unitRate = (outVal / inVal).toFixed(tokenOut === 'cirBTC' ? 8 : 4);
    return `1 ${tokenIn} ≈ ${unitRate} ${tokenOut}`;
  }, [quote, payAmount, tokenIn, tokenOut]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Feather name="arrow-left" size={22} color="#111827" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Network & App Kit Header */}
        <View style={styles.networkHeaderRow}>
          <View style={styles.networkBadge}>
            <View style={styles.networkDot} />
            <Text style={styles.networkBadgeText}>Arc Testnet (5042002)</Text>
          </View>
          <View style={styles.appKitBadge}>
            <Feather name="zap" size={12} color="#2563EB" />
            <Text style={styles.appKitBadgeText}>App Kit Swap</Text>
          </View>
        </View>

        {/* Wallet Address & Gas Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeaderRow}>
            <View style={styles.walletIdentity}>
              <View style={styles.walletIconWrap}>
                <Feather name="credit-card" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.walletLabel}>Driver Trading Wallet</Text>
                <TouchableOpacity onPress={() => void onCopyAddress()} style={styles.addressRow}>
                  <Text style={styles.walletAddress}>
                    {wallet?.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'Loading...'}
                  </Text>
                  <Feather name="copy" size={13} color="#6B7280" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.gasBadge}>
              <Feather name="check-circle" size={12} color="#059669" />
              <Text style={styles.gasBadgeText}>Gas Sponsored</Text>
            </View>
          </View>
        </View>

        {/* Swap Form */}
        <View style={styles.swapCard}>
          {/* Pay Input */}
          <View style={styles.tokenBox}>
            <View style={styles.tokenBoxTop}>
              <Text style={styles.boxLabel}>You Pay</Text>
              <View style={styles.presetRow}>
                {presets.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={styles.presetBtn}
                    onPress={() => {
                      void selectionImpact();
                      setPayAmount(preset);
                    }}
                  >
                    <Text style={styles.presetBtnText}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.tokenInputRow}>
              <TextInput
                style={styles.amountInput}
                value={payAmount}
                onChangeText={setPayAmount}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#9CA3AF"
                editable={!swapping}
              />
            </View>

            {/* Token In Selector Pills */}
            <View style={styles.tokenPillRow}>
              {SWAP_TOKENS.map((t) => {
                const active = t.symbol === tokenIn;
                return (
                  <TouchableOpacity
                    key={t.symbol}
                    style={[styles.tokenPill, active && styles.tokenPillActive]}
                    onPress={() => onSelectTokenIn(t.symbol)}
                  >
                    <Text style={[styles.tokenPillText, active && styles.tokenPillTextActive]}>
                      {t.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Flip Button */}
          <View style={styles.flipWrapper}>
            <TouchableOpacity style={styles.flipButton} onPress={onFlipDirection} disabled={swapping}>
              <Feather name="arrow-down" size={18} color="#2563EB" />
            </TouchableOpacity>
          </View>

          {/* Receive Output */}
          <View style={styles.tokenBox}>
            <View style={styles.tokenBoxTop}>
              <Text style={styles.boxLabel}>You Receive (Estimated)</Text>
              {loadingQuote ? <ActivityIndicator size="small" color="#2563EB" /> : null}
            </View>

            <View style={styles.tokenInputRow}>
              <Text style={[styles.amountDisplay, !quote && styles.amountDisplayEmpty]}>
                {quote ? quote.estOutputAmount : '0.00'}
              </Text>
            </View>

            {/* Token Out Selector Pills */}
            <View style={styles.tokenPillRow}>
              {SWAP_TOKENS.map((t) => {
                const active = t.symbol === tokenOut;
                return (
                  <TouchableOpacity
                    key={t.symbol}
                    style={[styles.tokenPill, active && styles.tokenPillActive]}
                    onPress={() => onSelectTokenOut(t.symbol)}
                  >
                    <Text style={[styles.tokenPillText, active && styles.tokenPillTextActive]}>
                      {t.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Quote & Rate Details */}
          {rateText ? (
            <View style={styles.quoteDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Exchange Rate</Text>
                <Text style={styles.detailValue}>{rateText}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Slippage Tolerance</Text>
                <Text style={styles.detailValue}>0.5%</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated Gas</Text>
                <Text style={[styles.detailValue, { color: '#059669', fontWeight: '600' }]}>
                  {quote?.estimatedGas ? `${quote.estimatedGas} USDC` : 'Free (Sponsored)'}
                </Text>
              </View>
            </View>
          ) : null}

          {quoteError ? (
            <View style={styles.quoteErrorBanner}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.quoteErrorText}>{quoteError}</Text>
            </View>
          ) : null}

          {/* Swap Action Button */}
          <TouchableOpacity
            style={[
              styles.swapSubmitButton,
              (!quote || swapping || loadingQuote) && styles.swapSubmitDisabled,
            ]}
            onPress={() => void handleExecuteSwap()}
            disabled={!quote || swapping || loadingQuote}
          >
            {swapping ? (
              <View style={styles.submitInner}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.swapSubmitText}>{swapStatusText || 'Swapping...'}</Text>
              </View>
            ) : loadingQuote ? (
              <Text style={styles.swapSubmitText}>Fetching Best Quote...</Text>
            ) : !payAmount || parseFloat(payAmount) <= 0 ? (
              <Text style={styles.swapSubmitText}>Enter an Amount</Text>
            ) : (
              <View style={styles.submitInner}>
                <Feather name="repeat" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.swapSubmitText}>Swap {tokenIn} for {tokenOut}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Swap History */}
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionLabel}>RECENT SWAPS</Text>
            {loadingHistory ? <ActivityIndicator size="small" color="#6B7280" /> : null}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Feather name="inbox" size={32} color="#D1D5DB" />
              <Text style={styles.emptyHistoryText}>No past swaps recorded yet.</Text>
            </View>
          ) : (
            history.map((record) => {
              const isSuccess = record.status === 'succeeded';
              const isFailed = record.status === 'failed';
              return (
                <View key={record.id} style={styles.historyRow}>
                  <View
                    style={[
                      styles.historyIcon,
                      isSuccess && styles.historyIconSuccess,
                      isFailed && styles.historyIconFailed,
                    ]}
                  >
                    <Feather
                      name={isSuccess ? 'check' : isFailed ? 'x' : 'clock'}
                      size={16}
                      color={isSuccess ? '#059669' : isFailed ? '#DC2626' : '#D97706'}
                    />
                  </View>

                  <View style={styles.historyInfo}>
                    <Text style={styles.historyPair}>
                      {record.sourceSymbol} → {record.destinationSymbol}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={styles.historyAmounts}>
                    <Text style={styles.historyAmountOut}>
                      +{parseFloat(record.outputAmount || '0').toFixed(record.destinationSymbol === 'cirBTC' ? 6 : 4)} {record.destinationSymbol}
                    </Text>
                    <Text style={styles.historyAmountIn}>
                      -{record.inputAmount} {record.sourceSymbol}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={!!completedSwap} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.modalTitle}>Swap Complete!</Text>
            <Text style={styles.modalDescription}>
              Successfully exchanged {completedSwap?.inputAmount} {completedSwap?.sourceSymbol} for {parseFloat(completedSwap?.outputAmount || '0').toFixed(completedSwap?.destinationSymbol === 'cirBTC' ? 6 : 4)} {completedSwap?.destinationSymbol}.
            </Text>

            {completedSwap?.hash ? (
              <View style={styles.txHashBox}>
                <Text style={styles.txHashLabel}>Transaction Hash</Text>
                <Text style={styles.txHashText} numberOfLines={1} ellipsizeMode="middle">
                  {completedSwap.hash}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                void selectionImpact();
                setCompletedSwap(null);
              }}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },
  networkHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  appKitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  appKitBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  walletAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  gasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  gasBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  swapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  tokenBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tokenBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  boxLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  tokenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  amountInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    padding: 0,
  },
  amountDisplay: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  amountDisplayEmpty: {
    color: '#9CA3AF',
  },
  tokenPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  tokenPillActive: {
    backgroundColor: '#2563EB',
  },
  tokenPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  flipWrapper: {
    alignItems: 'center',
    marginVertical: -12,
    zIndex: 2,
  },
  flipButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  quoteDetails: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  quoteErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 12,
  },
  quoteErrorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  swapSubmitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  swapSubmitDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  historySection: {
    marginTop: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  historyIconSuccess: {
    backgroundColor: '#D1FAE5',
  },
  historyIconFailed: {
    backgroundColor: '#FEE2E2',
  },
  historyInfo: {
    flex: 1,
  },
  historyPair: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  historyDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  historyAmounts: {
    alignItems: 'flex-end',
  },
  historyAmountOut: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  historyAmountIn: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  txHashBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  txHashLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  txHashText: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    color: '#374151',
  },
  modalButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
