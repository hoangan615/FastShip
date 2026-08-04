import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";

export default function OpsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="complaints" options={{ title: "Complaints" }} />
    </Tabs>
  );
}
