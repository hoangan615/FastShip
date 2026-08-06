import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";

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

  async function handleCreate() {
    if (!name || !price) return;
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
      queryClient.invalidateQueries({ queryKey: ["products", "mine"] });
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
        <TextField placeholder="Name" value={name} onChangeText={setName} />
        <TextField placeholder="Price" keyboardType="numeric" value={price} onChangeText={setPrice} />
        <TextField placeholder="Stock" keyboardType="numeric" value={stock} onChangeText={setStock} />
        <Button label="Add" onPress={handleCreate} loading={creating} />
      </View>

      <Text style={[theme.typography.heading, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
        Your products
      </Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={isLoading ? "Loading..." : "No products yet"}
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
              />
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
