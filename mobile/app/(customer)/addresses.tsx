import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";

export default function AddressesScreen() {
  const theme = useTheme();
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

  function confirmDelete(id: string, label: string) {
    Alert.alert("Remove address", `Remove "${label}" from your saved addresses?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await api.deleteMyAddress(id);
          queryClient.invalidateQueries({ queryKey: ["customers", "me", "addresses"] });
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Add address</Text>
      <View style={{ gap: theme.spacing.sm }}>
        <TextField placeholder="Label (e.g. Home, Work)" value={label} onChangeText={setLabel} />
        <TextField placeholder="Address" value={address} onChangeText={setAddress} />
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Latitude" keyboardType="numeric" value={lat} onChangeText={setLat} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Longitude" keyboardType="numeric" value={lng} onChangeText={setLng} />
          </View>
        </View>
        <Button label="Save address" onPress={handleAdd} loading={saving} />
      </View>

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        Saved addresses
      </Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(a) => a.id}
        scrollEnabled={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="location-outline"
            title={isLoading ? "Loading..." : "No saved addresses yet"}
            loading={isLoading}
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: theme.spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{item.label}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {item.address}
              </Text>
            </View>
            <IconButton
              name="trash-outline"
              color={theme.colors.danger}
              onPress={() => confirmDelete(item.id, item.label)}
            />
          </View>
        )}
      />
    </Screen>
  );
}
