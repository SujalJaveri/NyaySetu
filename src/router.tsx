import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes fresh
        gcTime: 1000 * 60 * 60 * 24, // Keep in memory/cache for 24 hours for offline viewing
        networkMode: "offlineFirst", // Prioritize cached data when network is unavailable
        refetchOnWindowFocus: false, // Disable refetch on tab focus
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 1000 * 15,
  });

  return router;
};
