import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/theme";

const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/home",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

export default function Index() {
  const theme = useTheme();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!token || !role) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={(ROLE_HOME[role] ?? "/(auth)/login") as never} />;
}
