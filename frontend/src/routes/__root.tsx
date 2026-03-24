import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "@posthog/react";
import { ThemeProvider } from "@/components/theme-provider";
import { posthog } from "@/posthog";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
