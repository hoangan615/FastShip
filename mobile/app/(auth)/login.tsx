import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, TextField } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";

const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/catalog",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      setAuth(res.access_token, res.role, res.user_id);
      router.replace((ROLE_HOME[res.role] ?? "/") as never);
    } catch (e: unknown) {
      setError("Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
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
          onChangeText={setEmail}
        />
        <TextField placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

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
  );
}
