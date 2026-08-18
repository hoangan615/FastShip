import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";
import { useToastStore, type ToastItem, type ToastVariant } from "@/stores/toastStore";

const AUTO_DISMISS_MS = 3000;

const ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 0,
        right: 0,
        alignItems: "center",
        gap: 8,
        zIndex: 1000,
      }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </View>
  );
}

function ToastRow({ toast }: { toast: ToastItem }) {
  const theme = useTheme();
  const dismiss = useToastStore((s) => s.dismiss);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
        dismiss(toast.id)
      );
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const palette: Record<ToastVariant, { bg: string; fg: string }> = {
    success: { bg: theme.colors.successBg, fg: theme.colors.successFg },
    error: { bg: theme.colors.dangerBg, fg: theme.colors.dangerFg },
    info: { bg: theme.colors.infoBg, fg: theme.colors.infoFg },
  };
  const p = palette[toast.variant];

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], maxWidth: "92%" }}>
      <Pressable
        onPress={() => dismiss(toast.id)}
        style={[
          theme.cardShadow,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: p.bg,
            borderRadius: theme.radius.md,
            paddingVertical: theme.spacing.sm + 2,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <Ionicons name={ICONS[toast.variant]} size={18} color={p.fg} />
        <Text style={[theme.typography.small, { color: p.fg, fontWeight: "600", flexShrink: 1 }]}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
