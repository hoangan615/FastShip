import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";

export default function ShipperLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="active-order" options={{ title: "Active order" }} />
    </Tabs>
  );
}
