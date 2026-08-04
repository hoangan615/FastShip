import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { useCartStore } from "@/stores/cartStore";
import type { Merchant, Product } from "@/types/api";

export default function CatalogScreen() {
  const router = useRouter();
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const cart = useCartStore();

  const merchantsQuery = useQuery({ queryKey: ["merchants"], queryFn: api.listMerchants });
  const productsQuery = useQuery({
    queryKey: ["products", selectedMerchant?.id],
    queryFn: () => api.listPublicProducts(selectedMerchant!.id),
    enabled: !!selectedMerchant,
  });

  const cartCount = Object.values(cart.lines).reduce((sum, l) => sum + l.qty, 0);

  if (!selectedMerchant) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Merchants</Text>
        <FlatList
          data={merchantsQuery.data ?? []}
          keyExtractor={(m) => m.id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {merchantsQuery.isLoading ? "Loading..." : "No merchants yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.merchantCard}
              onPress={() => {
                setSelectedMerchant(item);
                cart.setMerchant(item.id);
              }}
            >
              <Text style={styles.merchantName}>{item.name}</Text>
              <Text style={styles.merchantAddress}>{item.address}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setSelectedMerchant(null)}>
        <Text style={styles.backLink}>{"<"} Merchants</Text>
      </Pressable>
      <Text style={styles.heading}>{selectedMerchant.name}</Text>

      <FlatList
        data={productsQuery.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductRow product={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {productsQuery.isLoading ? "Loading..." : "No products available."}
          </Text>
        }
      />

      {cartCount > 0 && (
        <Pressable style={styles.checkoutBar} onPress={() => router.push("/(customer)/checkout")}>
          <Text style={styles.checkoutText}>View cart ({cartCount}) {"->"}</Text>
        </Pressable>
      )}
    </View>
  );
}

function ProductRow({ product }: { product: Product }) {
  const cart = useCartStore();
  const qty = cart.lines[product.id]?.qty ?? 0;

  return (
    <View style={styles.productRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>{product.price} VND</Text>
      </View>
      <View style={styles.qtyControls}>
        <Pressable style={styles.qtyButton} onPress={() => cart.removeOne(product.id)}>
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{qty}</Text>
        <Pressable style={styles.qtyButton} onPress={() => cart.addOne(product)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  backLink: { color: "#2563eb", marginBottom: 8 },
  empty: { color: "#94a3b8", textAlign: "center", marginTop: 24 },
  merchantCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  merchantName: { fontWeight: "700", fontSize: 15 },
  merchantAddress: { color: "#475569", fontSize: 13, marginTop: 2 },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  productName: { fontWeight: "600" },
  productPrice: { color: "#475569", marginTop: 2 },
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
  checkoutBar: {
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  checkoutText: { color: "white", fontWeight: "700" },
});
