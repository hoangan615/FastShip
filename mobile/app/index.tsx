import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "@/stores/authStore";

const ROLE_HOME: Record<string, string> = {
  customer: "/(customer)/catalog",
  merchant: "/(merchant)/incoming-orders",
  shipper: "/(shipper)/home",
  ops: "/(ops)/dashboard",
};

export default function Index() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token || !role) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={(ROLE_HOME[role] ?? "/(auth)/login") as never} />;
}
