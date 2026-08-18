import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Card, EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import type { MerchantAdmin } from "@/types/api";

export default function OpsSettingsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["ops", "settings"],
    queryFn: api.opsGetSettings,
  });
  const { data: merchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ["ops", "merchants"],
    queryFn: api.opsListMerchants,
  });

  const [baseFee, setBaseFee] = useState("");
  const [perKmRate, setPerKmRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBaseFee(String(Number(settings.shipping_base_fee)));
      setPerKmRate(String(Number(settings.shipping_per_km_rate)));
    }
  }, [settings]);

  async function saveShippingSettings() {
    setSaving(true);
    try {
      await api.opsUpdateSettings({
        shipping_base_fee: Number(baseFee),
        shipping_per_km_rate: Number(perKmRate),
      });
      queryClient.invalidateQueries({ queryKey: ["ops", "settings"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Shipping fee</Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        fee = base fee + per-km rate × distance
      </Text>
      {settingsLoading ? (
        <EmptyState icon="pricetag-outline" title="Loading..." loading />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            label="Base fee (VND)"
            keyboardType="numeric"
            value={baseFee}
            onChangeText={setBaseFee}
          />
          <TextField
            label="Per-km rate (VND)"
            keyboardType="numeric"
            value={perKmRate}
            onChangeText={setPerKmRate}
          />
          <Button label="Save shipping fee" onPress={saveShippingSettings} loading={saving} />
        </View>
      )}

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        Merchant commission
      </Text>
      <FlatList
        data={merchants ?? []}
        keyExtractor={(m) => m.id}
        scrollEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={merchantsLoading ? "Loading..." : "No merchants yet"}
            loading={merchantsLoading}
          />
        }
        renderItem={({ item }) => <MerchantCommissionRow merchant={item} />}
      />
    </Screen>
  );
}

function MerchantCommissionRow({ merchant }: { merchant: MerchantAdmin }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(Number(merchant.commission_rate) * 100));
  const [saving, setSaving] = useState(false);

  async function save() {
    const rate = Number(value) / 100;
    if (Number.isNaN(rate) || rate < 0 || rate > 1) return;
    setSaving(true);
    try {
      await api.opsUpdateMerchantCommission(merchant.id, rate);
      queryClient.invalidateQueries({ queryKey: ["ops", "merchants"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, flex: 1 }]}>{merchant.name}</Text>
      <View style={{ width: 64 }}>
        <TextField keyboardType="numeric" value={value} onChangeText={setValue} />
      </View>
      <Text style={{ color: theme.colors.textMuted }}>%</Text>
      <IconButton
        name="checkmark-circle"
        variant="filled"
        disabled={saving}
        onPress={save}
        testID={`save-commission-${merchant.id}`}
        accessibilityLabel={`Save commission rate for ${merchant.name}`}
      />
    </Card>
  );
}
