import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme";

export function EmptyState({
  icon,
  title,
  subtitle,
  loading = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  loading?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: theme.spacing.xxxl }]}>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Ionicons name={icon} size={36} color={theme.colors.textMuted} style={styles.icon} />
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: 6 },
  icon: { marginBottom: 4 },
  title: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  subtitle: { fontSize: 12, textAlign: "center" },
});
