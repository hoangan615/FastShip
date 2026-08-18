import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import { showToast } from "@/stores/toastStore";

interface FieldErrors {
  name?: string;
  price?: string;
}

export default function ProductsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["products", "mine"],
    queryFn: api.listMyProducts,
  });

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [data, search]);

  function validate(): FieldErrors {
    const priceNum = Number(price);
    return {
      name: !name.trim() ? "Name is required" : undefined,
      price: !price.trim() ? "Price is required" : Number.isNaN(priceNum) || priceNum <= 0 ? "Enter a valid price" : undefined,
    };
  }

  async function handleCreate() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setCreating(true);
    try {
      await api.createProduct({
        name,
        price: Number(price),
        stock_qty: Number(stock || 0),
      });
      setName("");
      setPrice("");
      setStock("");
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ["products", "mine"] });
      showToast("Product added");
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Could not add product. Please try again.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function adjustStock(productId: string, delta: number, currentQty: number) {
    const nextQty = Math.max(0, currentQty + delta);
    await api.updateProduct(productId, { stock_qty: nextQty });
    queryClient.invalidateQueries({ queryKey: ["products", "mine"] });
  }

  return (
    <Screen scroll>
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Add product</Text>
      <View style={{ gap: theme.spacing.sm }}>
        <TextField placeholder="Name" value={name} onChangeText={setName} error={errors.name} />
        <TextField
          placeholder="Price"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
          error={errors.price}
        />
        <TextField placeholder="Stock" keyboardType="numeric" value={stock} onChangeText={setStock} />
        <Button label="Add" onPress={handleCreate} loading={creating} />
      </View>

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        Your products
      </Text>
      {(data?.length ?? 0) > 0 && (
        <TextField placeholder="Search your products" value={search} onChangeText={setSearch} />
      )}
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={isLoading ? "Loading..." : search ? "No products match your search" : "No products yet"}
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
            <Pressable
              style={{ flex: 1 }}
              onPress={() => router.push(`/(merchant)/product/${item.id}` as never)}
            >
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{item.name}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {item.price} VND · {item.status}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <IconButton
                name="remove"
                variant="filled"
                size={16}
                onPress={() => adjustStock(item.id, -1, item.stock_qty)}
                accessibilityLabel={`Decrease stock for ${item.name}`}
              />
              <Text
                style={[
                  theme.typography.bodyStrong,
                  { color: theme.colors.text, minWidth: 20, textAlign: "center" },
                ]}
              >
                {item.stock_qty}
              </Text>
              <IconButton
                name="add"
                variant="filled"
                size={16}
                onPress={() => adjustStock(item.id, 1, item.stock_qty)}
                accessibilityLabel={`Increase stock for ${item.name}`}
              />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
