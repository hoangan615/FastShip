import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as api from "@/api/endpoints";
import type { ProductStatus } from "@/types/api";

const STATUSES: ProductStatus[] = ["active", "out_of_stock", "hidden"];

export default function EditProductScreen() {
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
      router.back();
    } catch (e) {
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} /> : null}

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Price (VND)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} />

      <Text style={styles.label}>Stock quantity</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={stockQty}
        onChangeText={setStockQty}
      />

      <Text style={styles.label}>Image URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        autoCapitalize="none"
        value={imageUrl}
        onChangeText={setImageUrl}
      />

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.statusChip, status === s && styles.statusChipSelected]}
            onPress={() => setStatus(s)}
          >
            <Text style={status === s ? styles.statusTextSelected : styles.statusText}>
              {s.replace("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        Stock quantity of 0 always forces the product to "out of stock" automatically.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  preview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: "#f1f5f9" },
  label: { fontWeight: "600", marginTop: 8, color: "#334155" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12 },
  statusRow: { flexDirection: "row", gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  statusChipSelected: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  statusText: { color: "#0f172a", textTransform: "capitalize" },
  statusTextSelected: { color: "white", textTransform: "capitalize" },
  hint: { color: "#94a3b8", fontSize: 12 },
  error: { color: "#dc2626" },
  saveButton: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: { color: "white", fontWeight: "700" },
});
