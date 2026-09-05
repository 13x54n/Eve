import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useLoginWithSMS, usePrivy } from "@privy-io/expo";
import {
  useLoginWithPasskey,
  useSignupWithPasskey,
} from "@privy-io/expo/passkey";
import { ActionButton } from "@/components/action-button";
import {
  formatPhoneForPrivy,
  isAlreadyAuthenticatedPrivyError,
  passkeyErrorMessage,
  requireRelyingParty,
} from "@/lib/privy";
import { useCompletePrivySession } from "@/lib/complete-privy-session";
import { useAuth } from "@/context/auth-context";
import type { AuthResponse } from "@/services/auth";

type Mode = "login" | "signup";

export function PrivyAuthForm({
  mode,
  onAuthenticated,
  disabled,
}: {
  mode: Mode;
  onAuthenticated: (user: AuthResponse["user"]) => void;
  disabled?: boolean;
}) {
  const { setUser } = useAuth();
  const { user: privyUser } = usePrivy();
  const completeSession = useCompletePrivySession();
  const { sendCode, loginWithCode, state } = useLoginWithSMS();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { signupWithPasskey } = useSignupWithPasskey();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<"sms" | "otp" | "passkey" | null>(null);

  async function finish() {
    const session = await completeSession();
    await setUser(session.user);
    onAuthenticated(session.user);
  }

  async function handleSendCode() {
    const formatted = formatPhoneForPrivy(phone);
    if (formatted.replace(/\D/g, "").length < 10) {
      Alert.alert("Invalid phone", "Enter a phone number with country code, for example +1 555 555 0100.");
      return;
    }
    try {
      setBusy("sms");
      await sendCode({ phone: formatted });
      setPhone(formatted);
      setCodeSent(true);
    } catch (error) {
      Alert.alert("Could not send code", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleLoginWithCode() {
    try {
      setBusy("otp");
      if (!privyUser) {
        try {
          await loginWithCode({
            code: code.trim(),
            phone: formatPhoneForPrivy(phone),
            disableSignup: mode === "login" ? undefined : false,
          });
        } catch (error) {
          if (!isAlreadyAuthenticatedPrivyError(error)) {
            throw error;
          }
        }
      }
      await finish();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (error instanceof Error ? error.message : "Login failed. Please try again.");
      Alert.alert("Login error", message);
    } finally {
      setBusy(null);
    }
  }

  async function handlePasskey() {
    try {
      setBusy("passkey");
      const relyingParty = requireRelyingParty();
      if (mode === "signup") {
        await signupWithPasskey({ relyingParty });
      } else {
        await loginWithPasskey({ relyingParty });
      }
      await finish();
    } catch (error) {
      Alert.alert(
        mode === "signup" ? "Passkey signup failed" : "Passkey login failed",
        passkeyErrorMessage(error),
      );
    } finally {
      setBusy(null);
    }
  }

  const sending = state.status === "sending-code" || busy === "sms";
  const submitting = state.status === "submitting-code" || busy === "otp";

  return (
    <View>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        keyboardType="phone-pad"
        autoComplete="tel"
        inputMode="tel"
        style={styles.input}
        editable={!disabled && busy === null}
      />
      {!codeSent ? (
        <ActionButton
          style={styles.button}
          textStyle={styles.buttonText}
          label="Send SMS code"
          loadingLabel="Sending code..."
          loading={sending}
          disabled={disabled}
          onPress={() => void handleSendCode()}
        />
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            keyboardType="number-pad"
            inputMode="numeric"
            style={styles.input}
            editable={!disabled && busy === null}
          />
          <ActionButton
            style={styles.button}
            textStyle={styles.buttonText}
            label="Continue with SMS"
            loadingLabel="Signing in..."
            loading={submitting}
            disabled={disabled}
            onPress={() => void handleLoginWithCode()}
          />
        </>
      )}

      <Text style={styles.or}>or</Text>

      <ActionButton
        style={styles.secondary}
        textStyle={styles.secondaryText}
        label={mode === "signup" ? "Create a passkey" : "Sign in with passkey"}
        loadingLabel="Waiting for passkey..."
        loading={busy === "passkey"}
        disabled={disabled}
        onPress={() => void handlePasskey()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    color: "#111827",
  },
  button: {
    padding: 16,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#2e4ed2",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
  },
  or: {
    marginTop: 20,
    textAlign: "center",
    color: "#6B7280",
    fontWeight: "600",
  },
  secondary: {
    padding: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  secondaryText: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "700",
  },
});
