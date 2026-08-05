import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen name="catalog" options={{ title: "Catalog" }} />
      <Tabs.Screen name="orders" options={{ title: "My Orders" }} />
      <Tabs.Screen name="addresses" options={{ title: "Addresses" }} />
      <Tabs.Screen name="checkout" options={{ title: "Checkout", href: null }} />
    </Tabs>
  );
}
