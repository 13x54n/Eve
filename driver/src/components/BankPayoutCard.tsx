import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  deleteBankAccount,
  registerBankAccount,
  type BankAccount,
} from '@/services/driver';

type Props = {
  accounts: BankAccount[];
  onChanged: () => Promise<void>;
};

export function BankPayoutCard({ accounts, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState('');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routing, setRouting] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  async function onSave() {
    setSaving(true);
    try {
      const result = await registerBankAccount({
        accountOwnerName: owner,
        bankName: bank || undefined,
        accountNumber,
        routingNumber: routing,
        streetLine1: street,
        city,
        state,
        postalCode: zip,
        country: 'USA',
      });
      setOpen(false);
      setAccountNumber('');
      setRouting('');
      await onChanged();
      Alert.alert('Bank account saved', result.note);
    } catch (caught: unknown) {
      const message =
        (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (caught instanceof Error ? caught.message : 'Could not save bank account');
      Alert.alert('Bank account', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Payout bank</Text>
      <Text style={styles.hint}>
        Saved for production cash-out. Privy Bridge does not settle on Arc Testnet.
      </Text>
      {accounts.map((account) => (
        <View key={account.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bank}>
              {account.bankName || 'Bank'} ····{account.last4}
            </Text>
            <Text style={styles.meta}>
              {account.accountOwnerName} · {account.payoutsLive ? 'live' : 'ready for production'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Alert.alert('Remove bank account', `Remove ····${account.last4}?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    void deleteBankAccount(account.id).then(onChanged);
                  },
                },
              ]);
            }}
          >
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {open ? (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Account owner" value={owner} onChangeText={setOwner} />
          <TextInput style={styles.input} placeholder="Bank name" value={bank} onChangeText={setBank} />
          <TextInput
            style={styles.input}
            placeholder="Account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Routing number"
            value={routing}
            onChangeText={setRouting}
            keyboardType="number-pad"
          />
          <TextInput style={styles.input} placeholder="Street" value={street} onChangeText={setStreet} />
          <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
          <TextInput style={styles.input} placeholder="State" value={state} onChangeText={setState} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="ZIP" value={zip} onChangeText={setZip} keyboardType="number-pad" />
          <Pressable style={styles.primary} onPress={() => void onSave()} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save bank account'}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.secondary} onPress={() => setOpen(true)}>
          <Text style={styles.secondaryText}>Add US bank account</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, gap: 10, marginTop: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  hint: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bank: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  remove: { color: '#DC2626', fontWeight: '600' },
  form: { gap: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primary: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryText: { color: '#111827', fontWeight: '700' },
});
