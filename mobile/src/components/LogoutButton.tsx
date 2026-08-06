import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { disconnectSocket } from "@/api/ws";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";

export function LogoutButton() {
  const theme = useTheme();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <Pressable
      onPress={() => {
        disconnectSocket();
        clearAuth();
        router.replace("/(auth)/login");
      }}
      hitSlop={8}
      style={styles.button}
    >
      <Ionicons name="log-out-outline" size={16} color={theme.colors.danger} />
      <Text style={[styles.label, { color: theme.colors.danger }]}>Sign out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  label: {
    fontWeight: "600",
  },
});
