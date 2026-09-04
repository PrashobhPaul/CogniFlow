import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StudioCanvas } from "@/components/studio/StudioCanvas";

const searchSchema = z.object({ project: z.string().optional(), d: z.string().optional() });

export const Route = createFileRoute("/studio")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Architecture Studio — Animated Data Flow Canvas" },
      {
        name: "description",
        content:
          "Infinite canvas studio: place components, declare semantic connectors, auto-layout, validate the graph and watch edge-bound particles animate real requests, retrieval, streams and events.",
      },
      { property: "og:title", content: "Architecture Studio — Animated Data Flow Canvas" },
      {
        property: "og:description",
        content:
          "Edit the canonical architecture graph and animate motion that is always bound to a validated connector.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioCanvas,
});
