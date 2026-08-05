import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as api from "@/api/endpoints";

export default function AddressesScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["customers", "me", "addresses"],
    queryFn: api.listMyAddresses,
  });

  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!label || !address || !lat || !lng) return;
    setSaving(true);
    try {
      await api.addMyAddress({ label, address, lat: Number(lat), lng: Number(lng) });
      setLabel("");
      setAddress("");
      setLat("");
      setLng("");
      queryClient.invalidateQueries({ queryKey: ["customers", "me", "addresses"] });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteMyAddress(id);
    queryClient.invalidateQueries({ queryKey: ["customers", "me", "addresses"] });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Add address</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Label (e.g. Home, Work)"
          value={label}
          onChangeText={setLabel}
        />
        <TextInput
          style={styles.input}
          placeholder="Address"
          value={address}
          onChangeText={setAddress}
        />
        <View style={styles.coordsRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Latitude"
            keyboardType="numeric"
            value={lat}
            onChangeText={setLat}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Longitude"
            keyboardType="numeric"
            value={lng}
            onChangeText={setLng}
          />
        </View>
        <Pressable style={styles.addButton} onPress={handleAdd} disabled={saving}>
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.addButtonText}>Save address</Text>}
        </Pressable>
      </View>

      <Text style={styles.heading}>Saved addresses</Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No saved addresses yet."}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.addressRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{item.label}</Text>
              <Text style={styles.addressText}>{item.address}</Text>
            </View>
            <Pressable onPress={() => handleDelete(item.id)}>
              <Text style={styles.deleteText}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 16, fontWeight: "700", marginTop: 12, marginBottom: 8 },
  form: { gap: 8 },
  coordsRow: { flexDirection: "row", gap: 8 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 10 },
  addButton: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  addButtonText: { color: "white", fontWeight: "700" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  addressLabel: { fontWeight: "600" },
  addressText: { color: "#475569", marginTop: 2 },
  deleteText: { color: "#dc2626", fontWeight: "600" },
});
