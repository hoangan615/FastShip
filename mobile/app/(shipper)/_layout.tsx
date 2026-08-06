import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";
import { tabIcon } from "@/components/TabBarIcon";
import { useTheme } from "@/theme";

export default function ShipperLayout() {
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
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home", "home-outline") }} />
      <Tabs.Screen
        name="active-order"
        options={{ title: "Active order", tabBarIcon: tabIcon("navigate", "navigate-outline") }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: "Earnings", tabBarIcon: tabIcon("cash", "cash-outline") }}
      />
    </Tabs>
  );
}
