import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import { showToast } from "@/stores/toastStore";

interface FieldErrors {
  label?: string;
  address?: string;
  lat?: string;
  lng?: string;
}

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
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return {
      label: !label.trim() ? "Label is required" : undefined,
      address: !address.trim() ? "Address is required" : undefined,
      lat: !lat.trim() ? "Latitude is required" : Number.isNaN(latNum) || latNum < -90 || latNum > 90 ? "Must be between -90 and 90" : undefined,
      lng: !lng.trim() ? "Longitude is required" : Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180 ? "Must be between -180 and 180" : undefined,
    };
  }

  async function handleAdd() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    try {
      await api.addMyAddress({ label, address, lat: Number(lat), lng: Number(lng) });
      setLabel("");
      setAddress("");
      setLat("");
      setLng("");
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["customers", "me", "addresses"] });
      showToast("Address saved");
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Could not save address. Please try again.", "error");
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
          showToast("Address removed");
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Add address</Text>
      <View style={{ gap: theme.spacing.sm }}>
        <TextField
          placeholder="Label (e.g. Home, Work)"
          value={label}
          onChangeText={setLabel}
          error={errors.label}
        />
        <TextField placeholder="Address" value={address} onChangeText={setAddress} error={errors.address} />
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="Latitude"
              keyboardType="numeric"
              value={lat}
              onChangeText={setLat}
              error={errors.lat}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="Longitude"
              keyboardType="numeric"
              value={lng}
              onChangeText={setLng}
              error={errors.lng}
            />
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
              accessibilityLabel={`Remove address ${item.label}`}
            />
          </View>
        )}
      />
    </Screen>
  );
}
