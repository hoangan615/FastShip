import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import * as api from "@/api/endpoints";
import { Button, Chip, Screen, TextField } from "@/components/ui";
import { useTheme } from "@/theme";
import { useCartStore } from "@/stores/cartStore";
import { showToast } from "@/stores/toastStore";
import type { PaymentMethod, SavedAddress } from "@/types/api";

const METHODS: PaymentMethod[] = ["wallet", "card", "cod"];
// No geocoding service is available in this demo, so a custom (non-saved)
// address needs its own lat/lng — same manual-entry pattern used on the
// Addresses screen — rather than silently reusing a fixed coordinate that
// wouldn't match whatever the customer actually typed.
const DEFAULT_CUSTOM_COORDS = { lat: "10.7829", lng: "106.6997" };
const PICKUP = { address: "Merchant pickup point", lat: 10.7769, lng: 106.7009 };

export default function CheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCartStore();
  const lines = Object.values(cart.lines);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [customLat, setCustomLat] = useState(DEFAULT_CUSTOM_COORDS.lat);
  const [customLng, setCustomLng] = useState(DEFAULT_CUSTOM_COORDS.lng);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userPickedAddress = useRef(false);

  const { data: savedAddresses } = useQuery({
    queryKey: ["customers", "me", "addresses"],
    queryFn: api.listMyAddresses,
  });

  // Default to the customer's first saved address instead of always
  // landing on the "Custom" tab — most orders ship to a known place.
  useEffect(() => {
    if (userPickedAddress.current || selectedAddress || !savedAddresses?.length) return;
    setSelectedAddress(savedAddresses[0]);
  }, [savedAddresses, selectedAddress]);

  const customCoordsValid =
    customAddress.trim().length > 0 && !Number.isNaN(Number(customLat)) && !Number.isNaN(Number(customLng));
  const addressReady = !!selectedAddress || customCoordsValid;
  const dropoff = selectedAddress
    ? { address: selectedAddress.address, lat: selectedAddress.lat, lng: selectedAddress.lng }
    : { address: customAddress, lat: Number(customLat), lng: Number(customLng) };

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["orders", "quote", dropoff.lat, dropoff.lng],
    queryFn: () => api.quoteShippingFee(PICKUP, dropoff),
    enabled: addressReady,
  });

  const subtotal = lines.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0);
  const shippingFee = quote ? Number(quote.shipping_fee) : 0;
  const grandTotal = subtotal + shippingFee;

  async function handlePlaceOrder() {
    if (!cart.merchantId || lines.length === 0 || !addressReady) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.createOrder({
        merchant_id: cart.merchantId,
        items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
        pickup_addr: PICKUP,
        dropoff_addr: dropoff,
        payment_method: method,
      });
      cart.clear();
      showToast("Order placed!");
      router.replace(`/order/${order.id}` as never);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      scroll
      stickyBottom={
        <Button
          label={`Place order · ${grandTotal.toLocaleString()} VND`}
          onPress={handlePlaceOrder}
          loading={submitting}
          disabled={lines.length === 0 || quoteLoading || !addressReady}
        />
      }
    >
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>Your order</Text>
      {lines.map((l) => (
        <View key={l.product.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text }}>
            {l.qty}x {l.product.name}
          </Text>
          <Text style={{ color: theme.colors.text }}>{(Number(l.product.price) * l.qty).toLocaleString()} VND</Text>
        </View>
      ))}

      <View
        style={{
          gap: 4,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingTop: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.textMuted }}>Subtotal</Text>
          <Text style={{ color: theme.colors.text }}>{subtotal.toLocaleString()} VND</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.textMuted }}>
            Delivery fee{quote ? ` (${quote.distance_km.toFixed(1)} km)` : ""}
          </Text>
          <Text style={{ color: theme.colors.text }}>
            {quoteLoading ? "…" : `${shippingFee.toLocaleString()} VND`}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>Total</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.text }]}>
            {grandTotal.toLocaleString()} VND
          </Text>
        </View>
      </View>

      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
        Delivery address
      </Text>
      {savedAddresses && savedAddresses.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {savedAddresses.map((a) => (
            <Chip
              key={a.id}
              label={a.label}
              selected={selectedAddress?.id === a.id}
              onPress={() => {
                userPickedAddress.current = true;
                setSelectedAddress(a);
              }}
            />
          ))}
          <Chip
            label="Custom"
            selected={selectedAddress === null}
            onPress={() => {
              userPickedAddress.current = true;
              setSelectedAddress(null);
            }}
          />
        </View>
      )}
      {selectedAddress ? (
        <Text
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            color: theme.colors.text,
          }}
        >
          {selectedAddress.address}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField placeholder="Address" value={customAddress} onChangeText={setCustomAddress} />
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Latitude"
                keyboardType="numeric"
                value={customLat}
                onChangeText={setCustomLat}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Longitude"
                keyboardType="numeric"
                value={customLng}
                onChangeText={setCustomLng}
              />
            </View>
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            No map lookup in this demo — the fee is calculated from these coordinates, so adjust them if
            they don't match the address you typed.
          </Text>
        </View>
      )}

      <Text style={[theme.typography.bodyStrong, { color: theme.colors.text, marginTop: theme.spacing.sm }]}>
        Payment method
      </Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        {METHODS.map((m) => (
          <Chip key={m} label={m.toUpperCase()} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </View>

      {error && <Text style={{ color: theme.colors.danger }}>{error}</Text>}
    </Screen>
  );
}
