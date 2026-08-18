import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { EmptyState, IconButton, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import { useCartStore } from "@/stores/cartStore";
import type { Merchant, Product } from "@/types/api";

export default function CatalogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { merchantId } = useLocalSearchParams<{ merchantId?: string }>();
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const cart = useCartStore();

  const merchantsQuery = useQuery({ queryKey: ["merchants"], queryFn: api.listMerchants });
  const filteredMerchants = useMemo(() => {
    const list = merchantsQuery.data ?? [];
    if (!merchantSearch.trim()) return list;
    const q = merchantSearch.trim().toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [merchantsQuery.data, merchantSearch]);

  useEffect(() => {
    if (!merchantId || selectedMerchant || !merchantsQuery.data) return;
    const match = merchantsQuery.data.find((m) => m.id === merchantId);
    if (match) {
      setSelectedMerchant(match);
      cart.setMerchant(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, merchantsQuery.data]);
  const productsQuery = useQuery({
    queryKey: ["products", selectedMerchant?.id],
    queryFn: () => api.listPublicProducts(selectedMerchant!.id),
    enabled: !!selectedMerchant,
  });
  const filteredProducts = useMemo(() => {
    const list = productsQuery.data ?? [];
    if (!productSearch.trim()) return list;
    const q = productSearch.trim().toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [productsQuery.data, productSearch]);

  const cartCount = Object.values(cart.lines).reduce((sum, l) => sum + l.qty, 0);

  if (!selectedMerchant) {
    return (
      <Screen>
        <Text style={[theme.typography.heading, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
          Merchants
        </Text>
        {(merchantsQuery.data?.length ?? 0) > 0 && (
          <View style={{ marginBottom: theme.spacing.md }}>
            <TextField placeholder="Search merchants" value={merchantSearch} onChangeText={setMerchantSearch} />
          </View>
        )}
        <FlatList
          data={filteredMerchants}
          keyExtractor={(m) => m.id}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title={
                merchantsQuery.isLoading
                  ? "Loading..."
                  : merchantSearch
                    ? "No merchants match your search"
                    : "No merchants yet"
              }
              loading={merchantsQuery.isLoading}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                {
                  padding: theme.spacing.md + 2,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginBottom: theme.spacing.sm + 2,
                  opacity: pressed ? 0.85 : 1,
                },
                theme.scheme === "light" ? theme.cardShadow : null,
              ]}
              onPress={() => {
                setSelectedMerchant(item);
                cart.setMerchant(item.id);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[theme.typography.subheading, { color: theme.colors.text }]}>{item.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="star" size={13} color={theme.colors.warning} />
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                    {Number(item.rating).toFixed(1)}
                  </Text>
                </View>
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
                {item.address}
              </Text>
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen
      stickyBottom={
        cartCount > 0 ? (
          <Pressable
            style={({ pressed }) => ({
              backgroundColor: theme.colors.success,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
              opacity: pressed ? 0.85 : 1,
            })}
            onPress={() => router.push("/(customer)/checkout")}
          >
            <Text style={{ color: theme.colors.textInverse, fontWeight: "600" }}>
              View cart ({cartCount})
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textInverse} />
          </Pressable>
        ) : undefined
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm }}>
        <IconButton
          name="chevron-back"
          onPress={() => setSelectedMerchant(null)}
          accessibilityLabel="Back to merchants"
        />
        <Text style={[theme.typography.body, { color: theme.colors.primary }]}>Merchants</Text>
      </View>
      <Text style={[theme.typography.heading, { color: theme.colors.text, marginBottom: theme.spacing.md }]}>
        {selectedMerchant.name}
      </Text>

      {(productsQuery.data?.length ?? 0) > 0 && (
        <View style={{ marginBottom: theme.spacing.md }}>
          <TextField placeholder="Search products" value={productSearch} onChangeText={setProductSearch} />
        </View>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <ProductRow product={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="fast-food-outline"
            title={
              productsQuery.isLoading
                ? "Loading..."
                : productSearch
                  ? "No products match your search"
                  : "No products available"
            }
            loading={productsQuery.isLoading}
          />
        }
      />
    </Screen>
  );
}

function ProductRow({ product }: { product: Product }) {
  const theme = useTheme();
  const cart = useCartStore();
  const qty = cart.lines[product.id]?.qty ?? 0;

  return (
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
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>{product.name}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 2 }]}>
          {product.price} VND
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton
          name="remove"
          variant="filled"
          size={16}
          onPress={() => cart.removeOne(product.id)}
          accessibilityLabel={`Remove one ${product.name}`}
        />
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, minWidth: 20, textAlign: "center" }]}>
          {qty}
        </Text>
        <IconButton
          name="add"
          variant="filled"
          size={16}
          testID={`qty-add-${product.id}`}
          onPress={() => cart.addOne(product)}
          accessibilityLabel={`Add one ${product.name}`}
        />
      </View>
    </View>
  );
}
