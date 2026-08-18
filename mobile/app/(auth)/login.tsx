import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, ScreenBackground, TextField } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";

const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/home",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function validate() {
    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? "Email is required"
      : !EMAIL_RE.test(trimmedEmail)
        ? "Enter a valid email"
        : null;
    const nextPasswordError = !password ? "Password is required" : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return !nextEmailError && !nextPasswordError;
  }

  async function handleLogin() {
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setAuth(res.access_token, res.role, res.user_id);
      router.replace((ROLE_HOME[res.role] ?? "/") as never);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Login failed. Check your email and password.");
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
          <Text style={[theme.typography.display, { color: theme.colors.text, textAlign: "center" }]}>
            FastShip
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textMuted, textAlign: "center", marginBottom: theme.spacing.lg },
            ]}
          >
            Sign in to continue
          </Text>

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

          {error && (
            <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{error}</Text>
          )}

          <View style={{ marginTop: theme.spacing.sm }}>
            <Button label="Sign in" onPress={handleLogin} loading={loading} />
          </View>

          <Link href="/(auth)/register" style={{ alignSelf: "center", marginTop: theme.spacing.lg }}>
            <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>No account? Register</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
