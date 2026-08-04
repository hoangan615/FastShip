import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as api from "@/api/endpoints";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types/api";

const ROLES: UserRole[] = ["customer", "merchant", "shipper", "ops"];
const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/catalog",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

export default function RegisterScreen() {
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Create account</Text>

      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>I am a...</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <Pressable
            key={r}
            style={[styles.roleChip, role === r && styles.roleChipSelected]}
            onPress={() => setRole(r)}
          >
            <Text style={role === r ? styles.roleTextSelected : styles.roleText}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Create account</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
  },
  label: { fontWeight: "600", marginTop: 8 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  roleChipSelected: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  roleText: { textTransform: "capitalize", color: "#0f172a" },
  roleTextSelected: { textTransform: "capitalize", color: "white" },
  button: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "white", fontWeight: "700" },
  error: { color: "#dc2626" },
});
