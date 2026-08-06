import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type RefreshControlProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

import { ScreenBackground } from "./ScreenBackground";

export function Screen({
  children,
  scroll = false,
  stickyBottom,
  refreshControl,
  padded = true,
  center = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  stickyBottom?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  padded?: boolean;
  center?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const content = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        padded && { padding: theme.spacing.lg },
        { paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
      ]}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        { flex: 1 },
        padded && { padding: theme.spacing.lg },
        center && { alignItems: "center", justifyContent: "center" },
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenBackground />
      {content}
      {stickyBottom && (
        <View
          style={[
            styles.sticky,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              paddingBottom: insets.bottom + theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.md,
            },
          ]}
        >
          {stickyBottom}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sticky: {
    borderTopWidth: 1,
  },
});
