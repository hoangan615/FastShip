import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";

export default function ActiveOrderScreen() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["shippers", "me"],
    queryFn: api.getMyShipperProfile,
    refetchInterval: 5_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (profile?.active_order_id) {
    return <Redirect href={`/order/${profile.active_order_id}` as never} />;
  }

  return (
    <View style={styles.center}>
      <Text style={styles.text}>No active order right now.</Text>
      <Text style={styles.hint}>Go online from Home to start receiving offers.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 6 },
  text: { fontSize: 16, fontWeight: "600" },
  hint: { color: "#64748b" },
});
