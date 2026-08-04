import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";

import { disconnectSocket } from "@/api/ws";
import { useAuthStore } from "@/stores/authStore";

export function LogoutButton() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <Pressable
      onPress={() => {
        disconnectSocket();
        clearAuth();
        router.replace("/(auth)/login");
      }}
      style={{ paddingHorizontal: 12 }}
    >
      <Text style={{ color: "#dc2626", fontWeight: "600" }}>Sign out</Text>
    </Pressable>
  );
}
