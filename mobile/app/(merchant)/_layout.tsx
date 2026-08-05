import { Tabs } from "expo-router";

import { LogoutButton } from "@/components/LogoutButton";

export default function MerchantLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: () => <LogoutButton /> }}>
      <Tabs.Screen name="incoming-orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="products" options={{ title: "Products" }} />
      <Tabs.Screen name="revenue" options={{ title: "Revenue" }} />
      <Tabs.Screen name="product/[id]" options={{ title: "Edit Product", href: null }} />
    </Tabs>
  );
}
