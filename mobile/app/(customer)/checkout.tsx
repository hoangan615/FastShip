import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as api from "@/api/endpoints";
import { useCartStore } from "@/stores/cartStore";
import type { PaymentMethod } from "@/types/api";

const METHODS: PaymentMethod[] = ["wallet", "card", "cod"];

export default function CheckoutScreen() {
  const router = useRouter();
  const cart = useCartStore();
  const lines = Object.values(cart.lines);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [dropoffAddress, setDropoffAddress] = useState("My place, District 1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);

  async function handlePlaceOrder() {
    if (!cart.merchantId || lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.createOrder({
        merchant_id: cart.merchantId,
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        // demo coordinates around central HCMC — a real app would geocode
        // the merchant/customer addresses or use device location.
        pickup_addr: { address: "Merchant pickup point", lat: 10.7769, lng: 106.7009 },
        dropoff_addr: { address: dropoffAddress, lat: 10.7829, lng: 106.6997 },
        payment_method: method,
      });
      cart.clear();
      router.replace(`/order/${order.id}` as never);
    } catch (e) {
      setError("Could not place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={styles.heading}>Your order</Text>
      {lines.map((l) => (
        <View key={l.product.id} style={styles.line}>
          <Text>
            {l.qty}x {l.product.name}
          </Text>
          <Text>{Number(l.product.price) * l.qty} VND</Text>
        </View>
      ))}
      <View style={[styles.line, styles.totalLine]}>
        <Text style={styles.totalText}>Total</Text>
        <Text style={styles.totalText}>{total} VND</Text>
      </View>

      <Text style={styles.label}>Delivery address</Text>
      <TextInput style={styles.input} value={dropoffAddress} onChangeText={setDropoffAddress} />

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <Pressable
            key={m}
            style={[styles.methodChip, method === m && styles.methodChipSelected]}
            onPress={() => setMethod(m)}
          >
            <Text style={method === m ? styles.methodTextSelected : styles.methodText}>
              {m.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={handlePlaceOrder}
        disabled={submitting || lines.length === 0}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Place order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 20, fontWeight: "700" },
  line: { flexDirection: "row", justifyContent: "space-between" },
  totalLine: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, marginTop: 4 },
  totalText: { fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  methodChipSelected: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  methodText: { color: "#0f172a" },
  methodTextSelected: { color: "white" },
  button: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "white", fontWeight: "700" },
  error: { color: "#dc2626" },
});
