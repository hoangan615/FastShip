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

export default function ProductsScreen() {
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
    <View style={styles.container}>
      <Text style={styles.heading}>Add product</Text>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Price"
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />
        <TextInput
          style={styles.input}
          placeholder="Stock"
          keyboardType="numeric"
          value={stock}
          onChangeText={setStock}
        />
        <Pressable style={styles.addButton} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color="white" /> : <Text style={styles.addButtonText}>Add</Text>}
        </Pressable>
      </View>

      <Text style={styles.heading}>Your products</Text>
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text style={styles.empty}>{isLoading ? "Loading..." : "No products yet."}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.productRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productMeta}>
                {item.price} VND · {item.status}
              </Text>
            </View>
            <View style={styles.qtyControls}>
              <Pressable
                style={styles.qtyButton}
                onPress={() => adjustStock(item.id, -1, item.stock_qty)}
              >
                <Text style={styles.qtyButtonText}>-</Text>
              </Pressable>
              <Text style={styles.qtyValue}>{item.stock_qty}</Text>
              <Pressable
                style={styles.qtyButton}
                onPress={() => adjustStock(item.id, 1, item.stock_qty)}
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </Pressable>
            </View>
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
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 10 },
  addButton: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  addButtonText: { color: "white", fontWeight: "700" },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  productName: { fontWeight: "600" },
  productMeta: { color: "#475569", marginTop: 2, textTransform: "capitalize" },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
  qtyValue: { minWidth: 20, textAlign: "center", fontWeight: "600" },
});
