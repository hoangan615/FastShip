import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";
import { tabIcon } from "@/components/TabBarIcon";
import { useTheme } from "@/theme";

export default function CustomerLayout() {
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
        name="home"
        options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="catalog"
        options={{ title: "Catalog", tabBarIcon: tabIcon("storefront", "storefront-outline") }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "My Orders", tabBarIcon: tabIcon("receipt", "receipt-outline") }}
      />
      <Tabs.Screen
        name="addresses"
        options={{ title: "Addresses", tabBarIcon: tabIcon("location", "location-outline") }}
      />
      <Tabs.Screen name="checkout" options={{ title: "Checkout", href: null }} />
    </Tabs>
  );
}
