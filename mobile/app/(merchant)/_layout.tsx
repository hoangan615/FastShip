import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";
import { tabIcon } from "@/components/TabBarIcon";
import { useTheme } from "@/theme";

export default function MerchantLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => <LogoutButton />,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="incoming-orders"
        options={{ title: "Orders", tabBarIcon: tabIcon("receipt", "receipt-outline") }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: "Products", tabBarIcon: tabIcon("cube", "cube-outline") }}
      />
      <Tabs.Screen
        name="revenue"
        options={{ title: "Revenue", tabBarIcon: tabIcon("stats-chart", "stats-chart-outline") }}
      />
      <Tabs.Screen name="product/[id]" options={{ title: "Edit Product", href: null }} />
    </Tabs>
  );
}
