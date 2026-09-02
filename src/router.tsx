import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Static SPA router. `BASE_URL` comes from Vite (`BASE_PATH` at build time) so
 * the same bundle works at a domain root and under /ArchAnimate/ on GitHub Pages.
 */
export const getRouter = () => {
  const queryClient = new QueryClient();
  const basepath = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
  return createRouter({
    routeTree,
    basepath,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
