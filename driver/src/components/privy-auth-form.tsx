import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLoginWithEmail, useLoginWithSMS, usePrivy } from "@privy-io/expo";
import { ActionButton } from "@/components/action-button";
import {
  formatEmailForPrivy,
  formatPhoneForPrivy,
  isAlreadyAuthenticatedPrivyError,
} from "@/lib/privy";
import { useCompletePrivySession } from "@/lib/complete-privy-session";
import { useAuth } from "@/context/auth-context";
import type { AuthResponse } from "@/services/auth";

type Mode = "login" | "signup";
type Method = "sms" | "email";

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
  const sms = useLoginWithSMS();
  const emailLogin = useLoginWithEmail();
  const [method, setMethod] = useState<Method>("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<"send" | "otp" | null>(null);

  async function finish() {
    const session = await completeSession();
    await setUser(session.user);
    onAuthenticated(session.user);
  }

  function switchMethod(next: Method) {
    if (next === method) return;
    setMethod(next);
    setCode("");
    setCodeSent(false);
  }

  async function handleSendCode() {
    try {
      setBusy("send");
      if (method === "sms") {
        const formatted = formatPhoneForPrivy(phone);
        if (formatted.replace(/\D/g, "").length < 10) {
          Alert.alert(
            "Invalid phone",
            "Enter a phone number with country code, for example +1 555 555 0100.",
          );
          return;
        }
        await sms.sendCode({ phone: formatted });
        setPhone(formatted);
      } else {
        const formatted = formatEmailForPrivy(email);
        if (!formatted.includes("@") || !formatted.includes(".")) {
          Alert.alert("Invalid email", "Enter a valid email address.");
          return;
        }
        await emailLogin.sendCode({ email: formatted });
        setEmail(formatted);
      }
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
          const disableSignup = mode === "login" ? undefined : false;
          if (method === "sms") {
            await sms.loginWithCode({
              code: code.trim(),
              phone: formatPhoneForPrivy(phone),
              disableSignup,
            });
          } else {
            await emailLogin.loginWithCode({
              code: code.trim(),
              email: formatEmailForPrivy(email),
              disableSignup,
            });
          }
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

  const sending =
    busy === "send" ||
    sms.state.status === "sending-code" ||
    emailLogin.state.status === "sending-code";
  const submitting =
    busy === "otp" ||
    sms.state.status === "submitting-code" ||
    emailLogin.state.status === "submitting-code";
  const channelLabel = method === "sms" ? "SMS" : "email";

  return (
    <View>
      <View style={styles.methodRow}>
        <Pressable
          onPress={() => switchMethod("sms")}
          style={[styles.methodTab, method === "sms" && styles.methodTabActive]}
          disabled={disabled || busy !== null}
        >
          <Text style={[styles.methodText, method === "sms" && styles.methodTextActive]}>Phone</Text>
        </Pressable>
        <Pressable
          onPress={() => switchMethod("email")}
          style={[styles.methodTab, method === "email" && styles.methodTabActive]}
          disabled={disabled || busy !== null}
        >
          <Text style={[styles.methodText, method === "email" && styles.methodTextActive]}>Email</Text>
        </Pressable>
      </View>

      {method === "sms" ? (
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
      ) : (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="email"
          style={styles.input}
          editable={!disabled && busy === null}
        />
      )}
      {!codeSent ? (
        <ActionButton
          style={styles.button}
          textStyle={styles.buttonText}
          label={`Send ${channelLabel} code`}
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
            label={`Continue with ${channelLabel}`}
            loadingLabel="Signing in..."
            loading={submitting}
            disabled={disabled}
            onPress={() => void handleLoginWithCode()}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  methodRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  methodTabActive: {
    borderColor: "#2e4ed2",
    backgroundColor: "#EEF2FF",
  },
  methodText: {
    fontWeight: "700",
    color: "#6B7280",
  },
  methodTextActive: {
    color: "#2e4ed2",
  },
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
});
