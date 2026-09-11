import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PrivyBankAccount,
  RegisterBankAccountInput,
  registerBankAccount,
  deleteBankAccount,
} from '@/services/driver';
import { lightImpact } from '@/lib/haptics';

interface BankAccountModalProps {
  visible: boolean;
  onClose: () => void;
  accounts: PrivyBankAccount[];
  onAccountsUpdated: () => void;
  onSelectAccount?: (account: PrivyBankAccount) => void;
  selectedAccountId?: string;
}

export function BankAccountModal({
  visible,
  onClose,
  accounts,
  onAccountsUpdated,
  onSelectAccount,
  selectedAccountId,
}: BankAccountModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [ownerName, setOwnerName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [checkingOrSavings, setCheckingOrSavings] = useState<'checking' | 'savings'>('checking');
  const [street1, setStreet1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const resetForm = () => {
    setOwnerName('');
    setBankName('');
    setAccountNumber('');
    setRoutingNumber('');
    setCheckingOrSavings('checking');
    setStreet1('');
    setCity('');
    setState('');
    setPostalCode('');
    setShowAddForm(false);
  };

  const handleRegister = async () => {
    if (!ownerName.trim()) {
      Alert.alert('Validation', 'Please enter the account owner legal name');
      return;
    }
    const cleanRouting = routingNumber.trim();
    if (!/^\d{9}$/.test(cleanRouting)) {
      Alert.alert('Validation', 'US Routing number must be exactly 9 digits');
      return;
    }
    const cleanAccount = accountNumber.trim();
    if (cleanAccount.length < 4) {
      Alert.alert('Validation', 'Please enter a valid bank account number');
      return;
    }
    if (!street1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
      Alert.alert('Validation', 'Please provide complete address details for bank verification');
      return;
    }

    try {
      setSubmitting(true);
      const payload: RegisterBankAccountInput = {
        accountOwnerName: ownerName.trim(),
        bankName: bankName.trim() || 'Bank',
        accountType: 'us',
        accountNumber: cleanAccount,
        routingNumber: cleanRouting,
        checkingOrSavings,
        address: {
          streetLine1: street1.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          postalCode: postalCode.trim(),
          country: 'USA',
        },
      };

      const newAccount = await registerBankAccount(payload);
      lightImpact();
      resetForm();
      onAccountsUpdated();
      if (onSelectAccount) {
        onSelectAccount(newAccount);
      }
      Alert.alert('Bank Account Linked', `Successfully added ${newAccount.bank_name || 'Bank'} (••••${newAccount.last_4})`);
    } catch (caught: unknown) {
      const message =
        (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (caught instanceof Error ? caught.message : 'Could not link bank account');
      Alert.alert('Registration Failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (account: PrivyBankAccount) => {
    Alert.alert(
      'Remove Bank Account',
      `Are you sure you want to remove ${account.bank_name || 'Bank'} (••••${account.last_4})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(account.id);
              await deleteBankAccount(account.id);
              lightImpact();
              onAccountsUpdated();
            } catch (caught: unknown) {
              const message =
                (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                (caught instanceof Error ? caught.message : 'Could not remove bank account');
              Alert.alert('Error', message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Bank Accounts</Text>
              <Text style={styles.modalSubtitle}>Withdraw wallet crypto to your external bank</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {!showAddForm ? (
              <>
                {accounts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="business-outline" size={48} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>No Bank Accounts Linked</Text>
                    <Text style={styles.emptySubtitle}>
                      Link an external bank account to withdraw USDC earnings directly to USD cash.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.accountsList}>
                    {accounts.map((acc) => {
                      const isSelected = selectedAccountId === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                          onPress={() => {
                            if (onSelectAccount) {
                              onSelectAccount(acc);
                              lightImpact();
                              onClose();
                            }
                          }}
                        >
                          <View style={styles.accountCardLeft}>
                            <View style={[styles.bankIconBg, isSelected && styles.bankIconBgSelected]}>
                              <Ionicons
                                name="business"
                                size={20}
                                color={isSelected ? '#2E4ED2' : '#475569'}
                              />
                            </View>
                            <View>
                              <Text style={styles.bankNameText}>
                                {acc.bank_name || 'Bank Account'} ••••{acc.last_4}
                              </Text>
                              <Text style={styles.accountHolderText}>
                                {acc.account_owner_name} • {acc.account_type.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.accountCardRight}>
                            {isSelected ? (
                              <Ionicons name="checkmark-circle" size={22} color="#2E4ED2" />
                            ) : null}
                            <TouchableOpacity
                              style={styles.deleteBtn}
                              onPress={() => handleDelete(acc)}
                              disabled={deletingId === acc.id}
                            >
                              {deletingId === acc.id ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                              ) : (
                                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity style={styles.addAccountBtn} onPress={() => setShowAddForm(true)}>
                  <Ionicons name="add-circle-outline" size={20} color="#2E4ED2" />
                  <Text style={styles.addAccountText}>Add New Bank Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Add Bank Account Form */
              <View style={styles.formContainer}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formSectionTitle}>Link US Bank Account</Text>
                  <TouchableOpacity onPress={() => setShowAddForm(false)}>
                    <Text style={styles.cancelFormText}>Back to accounts</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Legal Account Owner Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  autoCapitalize="words"
                  editable={!submitting}
                />

                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Chase, Bank of America, etc."
                  value={bankName}
                  onChangeText={setBankName}
                  editable={!submitting}
                />

                <Text style={styles.inputLabel}>Account Type</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      checkingOrSavings === 'checking' && styles.toggleBtnActive,
                    ]}
                    onPress={() => setCheckingOrSavings('checking')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        checkingOrSavings === 'checking' && styles.toggleBtnTextActive,
                      ]}
                    >
                      Checking
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      checkingOrSavings === 'savings' && styles.toggleBtnActive,
                    ]}
                    onPress={() => setCheckingOrSavings('savings')}
                  >
                    <Text
                      style={[
                        styles.toggleBtnText,
                        checkingOrSavings === 'savings' && styles.toggleBtnTextActive,
                      ]}
                    >
                      Savings
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Routing Number (9 digits)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="121212121"
                  value={routingNumber}
                  onChangeText={setRoutingNumber}
                  keyboardType="number-pad"
                  maxLength={9}
                  editable={!submitting}
                />

                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1234567890"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  secureTextEntry
                  editable={!submitting}
                />

                <Text style={styles.formSectionTitle}>Billing Address (for verification)</Text>

                <Text style={styles.inputLabel}>Street Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Main St, Apt 4B"
                  value={street1}
                  onChangeText={setStreet1}
                  editable={!submitting}
                />

                <View style={styles.rowInputs}>
                  <View style={{ flex: 2, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="New York"
                      value={city}
                      onChangeText={setCity}
                      editable={!submitting}
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="NY"
                      value={state}
                      onChangeText={setState}
                      autoCapitalize="characters"
                      maxLength={2}
                      editable={!submitting}
                    />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.inputLabel}>ZIP</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10001"
                      value={postalCode}
                      onChangeText={setPostalCode}
                      keyboardType="number-pad"
                      editable={!submitting}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={() => void handleRegister()}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} /> : null}
                  <Text style={styles.submitButtonText}>{submitting ? 'Linking Account…' : 'Link Bank Account'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 12 },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  accountsList: { marginBottom: 16 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  accountCardSelected: {
    borderColor: '#2E4ED2',
    backgroundColor: '#EFF6FF',
  },
  accountCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bankIconBgSelected: {
    backgroundColor: '#DBEAFE',
  },
  bankNameText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  accountHolderText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  accountCardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { padding: 6 },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  addAccountText: { fontSize: 15, fontWeight: '600', color: '#2E4ED2' },
  formContainer: { marginTop: 4 },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  formSectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginTop: 12, marginBottom: 8 },
  cancelFormText: { fontSize: 13, color: '#2E4ED2', fontWeight: '500' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2E4ED2',
  },
  toggleBtnText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  toggleBtnTextActive: { color: '#2E4ED2', fontWeight: '600' },
  rowInputs: { flexDirection: 'row', alignItems: 'center' },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2E4ED2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});

