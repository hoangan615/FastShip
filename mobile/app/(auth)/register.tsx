import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Chip, TextField } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";
import type { UserRole } from "@/types/api";

const ROLES: UserRole[] = ["customer", "merchant", "shipper", "ops"];
const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/catalog",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

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

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.register({ email: email.trim(), password, role, name: name.trim() });
      setAuth(res.access_token, res.role, res.user_id);
      router.replace((ROLE_HOME[res.role] ?? "/") as never);
    } catch (e: unknown) {
      setError("Registration failed. Try a different email.");
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
        <Text
          style={[
            theme.typography.title,
            { color: theme.colors.text, textAlign: "center", marginBottom: theme.spacing.sm },
          ]}
        >
          Create account
        </Text>

        <TextField placeholder="Name" value={name} onChangeText={setName} />
        <TextField
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

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
  );
}
