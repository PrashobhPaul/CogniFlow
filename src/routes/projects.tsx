import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { History, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteProject, listProjects, type Project } from "@/lib/studio/projects";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects & Versions — AI Architecture Motion Studio" },
      {
        name: "description",
        content:
          "Every architecture project with its graph version, content hash and recoverable version history, ready to reopen in the motion studio.",
      },
      { property: "og:title", content: "Projects & Versions — AI Architecture Motion Studio" },
      {
        property: "og:description",
        content: "Reopen, inspect and recover versions of your architecture graphs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Projects,
});

function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(() => listProjects());
  const [openHistory, setOpenHistory] = useState<string | null>(null);

  return (
    <AppShell
      title="Projects"
      subtitle="Each project stores the canonical graph, its version number and a deterministic content hash, so any earlier version can be recovered exactly. This prototype stores projects in this browser; Cloud adds accounts, organizations and server-side project isolation."
    >
      {projects.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
            Create New Architecture
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.project_id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    v{p.graph_version} · hash {p.graph_hash} · {p.graph.nodes.length} components ·{" "}
                    {p.graph.edges.length} connectors · source {p.source_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setOpenHistory(openHistory === p.project_id ? null : p.project_id)
                    }
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    {p.versions.length} versions
                  </Button>
                  <Link to="/studio" search={{ project: p.project_id }}>
                    <Button size="sm">Open</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      deleteProject(p.project_id);
                      setProjects(listProjects());
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {openHistory === p.project_id && (
                <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                  {[...p.versions].reverse().map((v) => (
                    <li
                      key={v.graph_version}
                      className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
                    >
                      <span>
                        v{v.graph_version} · {v.graph_hash} · {v.note}
                      </span>
                      <span>{new Date(v.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
