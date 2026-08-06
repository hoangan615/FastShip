import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme";

export function TextField({
  label,
  error,
  style,
  ...inputProps
}: TextInputProps & { label?: string; error?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>}
      <TextInput
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            borderColor,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
          },
          style,
        ]}
      />
      {error && <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    fontSize: 15,
  },
  error: { fontSize: 12, fontWeight: "600" },
});
