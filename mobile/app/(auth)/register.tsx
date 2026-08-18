import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Chip, ScreenBackground, TextField } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";
import type { UserRole } from "@/types/api";

const ROLES: UserRole[] = ["customer", "merchant", "shipper", "ops"];
const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/home",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function RegisterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validate() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nextNameError = !trimmedName ? "Name is required" : null;
    const nextEmailError = !trimmedEmail
      ? "Email is required"
      : !EMAIL_RE.test(trimmedEmail)
        ? "Enter a valid email"
        : null;
    const nextPasswordError =
      password.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters` : null;
    setNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return !nextNameError && !nextEmailError && !nextPasswordError;
  }

  async function handleRegister() {
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.register({ email: email.trim(), password, role, name: name.trim() });
      setAuth(res.access_token, res.role, res.user_id);
      router.replace((ROLE_HOME[res.role] ?? "/") as never);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Registration failed. Try a different email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "transparent" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: theme.spacing.xxl, gap: theme.spacing.md }}>
          <Text
            style={[
              theme.typography.title,
              { color: theme.colors.text, textAlign: "center", marginBottom: theme.spacing.sm },
            ]}
          >
            Create account
          </Text>

          <TextField
            placeholder="Name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError ?? undefined}
          />
          <TextField
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) setEmailError(null);
            }}
            error={emailError ?? undefined}
          />
          <TextField
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
            error={passwordError ?? undefined}
          />

          <Text
            style={[theme.typography.bodyStrong, { color: theme.colors.text, marginTop: theme.spacing.xs }]}
          >
            I am a...
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {ROLES.map((r) => (
              <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
            ))}
          </View>

          {error && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
          )}

          <View style={{ marginTop: theme.spacing.sm }}>
            <Button label="Create account" onPress={handleRegister} loading={loading} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
