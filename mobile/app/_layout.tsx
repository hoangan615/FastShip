import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastHost } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { showToast } from "@/stores/toastStore";
import { ThemeProvider, useTheme } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 3_000,
    },
  },
});

// Redirects to login the moment a session goes from authenticated to
// signed-out mid-use (expired/invalid token cleared by the API client's
// 401/403 interceptor) — otherwise the user is stranded on a role screen
// where every request now silently fails.
function useSessionExpiryRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const wasAuthed = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (token) {
      wasAuthed.current = true;
      return;
    }
    const inAuthGroup = segments[0] === "(auth)";
    if (wasAuthed.current && !inAuthGroup) {
      wasAuthed.current = false;
      showToast("Session expired. Please sign in again.", "error");
      router.replace("/(auth)/login");
    }
  }, [token, hasHydrated, segments, router]);
}

function RootStack() {
  const theme = useTheme();
  useSessionExpiryRedirect();
  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(merchant)" />
        <Stack.Screen name="(shipper)" />
        <Stack.Screen name="(ops)" />
        <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order" }} />
      </Stack>
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
