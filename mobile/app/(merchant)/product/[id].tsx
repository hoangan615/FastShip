import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Chip, EmptyState, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import { showToast } from "@/stores/toastStore";
import type { ProductStatus } from "@/types/api";

const STATUSES: ProductStatus[] = ["active", "out_of_stock", "hidden"];

export default function EditProductScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "mine"],
    queryFn: api.listMyProducts,
  });
  const product = products?.find((p) => p.id === id);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<ProductStatus>("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(String(product.price));
      setStockQty(String(product.stock_qty));
      setImageUrl(product.image_url ?? "");
      setStatus(product.status);
    }
  }, [product]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateProduct(id, {
        name,
        price: Number(price),
        stock_qty: Number(stockQty),
        image_url: imageUrl || undefined,
        status,
      });
      queryClient.invalidateQueries({ queryKey: ["products", "mine"] });
      showToast("Product updated");
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !product) {
    return (
      <Screen center>
        <EmptyState icon="cube-outline" title="Loading..." loading />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: 180, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceAlt }}
        />
      ) : null}

      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Price (VND)" keyboardType="numeric" value={price} onChangeText={setPrice} />
      <TextField
        label="Stock quantity"
        keyboardType="numeric"
        value={stockQty}
        onChangeText={setStockQty}
      />
      <TextField
        label="Image URL"
        placeholder="https://..."
        autoCapitalize="none"
        value={imageUrl}
        onChangeText={setImageUrl}
      />

      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>Visibility</Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        {STATUSES.map((s) => (
          <Chip key={s} label={s.replace("_", " ")} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>
      <Text style={[theme.typography.small, { color: theme.colors.textMuted, fontWeight: "400" }]}>
        Stock quantity of 0 always forces the product to "out of stock" automatically.
      </Text>

      {error && <Text style={{ color: theme.colors.danger }}>{error}</Text>}

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button label="Save changes" onPress={handleSave} loading={saving} />
      </View>
    </Screen>
  );
}
