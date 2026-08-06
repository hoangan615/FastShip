import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";
import { tabIcon } from "@/components/TabBarIcon";
import { useTheme } from "@/theme";

export default function OpsLayout() {
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
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: tabIcon("speedometer", "speedometer-outline") }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{ title: "Heatmap", tabBarIcon: tabIcon("flame", "flame-outline") }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: "Complaints", tabBarIcon: tabIcon("alert-circle", "alert-circle-outline") }}
      />
    </Tabs>
  );
}
