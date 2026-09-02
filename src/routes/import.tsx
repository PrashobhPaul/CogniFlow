import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, FileCode2, ImageUp, Loader2, Settings2, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GraphReview } from "@/components/studio/GraphReview";
import { ModelStatus } from "@/components/studio/ModelStatus";
import { importDrawio } from "@/lib/studio/drawio";
import type { AirGraph } from "@/lib/studio/air";
import { autoLayout } from "@/lib/studio/layout";
import { createProject, type SourceType } from "@/lib/studio/projects";
import { compileWithAi } from "@/lib/studio/ai/compile";
import { candidateToGraph } from "@/lib/studio/candidate";
import { useEntitlements } from "@/lib/studio/use-entitlements";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import & Reconstruction Review — ArchAnimate" },
      {
        name: "description",
        content:
          "Import draw.io / mxGraph XML, or reconstruct an architecture from an image plus instructions with an open-weight vision model, then review every component and connector before anything animates.",
      },
    ],
  }),
  component: ImportPage,
});

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

function ImportPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const { entitlements } = useEntitlements();
  const canReconstruct = entitlements.features.imageReconstruction;

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<string | null>(null);
  const [source, setSource] = useState<SourceType>("drawio");
  const [engine, setEngine] = useState("");
  const [graph, setGraph] = useState<AirGraph | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setGraph(null);
    setWarnings([]);
  };

  const pickImage = async (file: File) => {
    setError(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!IMAGE_EXT.includes(ext)) {
      setError("Only PNG, JPG, JPEG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image exceeds the 8 MB limit.");
      return;
    }
    setImageFile(file);
    setImagePreview(await readAsDataUrl(file));
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const reconstruct = async () => {
    if (!imageFile && !instructions.trim()) {
      setError("Add an image, instructions, or both.");
      return;
    }
    reset();
    setBusy(true);
    try {
      const dataUrl = imageFile ? await readAsDataUrl(imageFile) : undefined;
      const result = await compileWithAi({
        prompt: instructions.trim() || undefined,
        imageDataUrl: dataUrl,
        filename: imageFile?.name,
      });
      const converted = candidateToGraph(result.candidate);
      setSource(imageFile ? "image" : "prompt");
      setGraph(converted.graph);
      setWarnings(converted.warnings);
      setEngine(`${result.engine === "local" ? "in-browser" : "endpoint"} model · ${result.model}`);
      setFileRef(imageFile?.name ?? null);
      if (!name && converted.title) setName(converted.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconstruction failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    reset();
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "drawio" && ext !== "xml") {
      setError("Only .drawio and .xml files are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File exceeds the 4 MB limit.");
      return;
    }
    try {
      const text = await file.text();
      const result = importDrawio(text);
      const laid = autoLayout(result.graph);
      setSource("drawio");
      setGraph(laid);
      setWarnings(result.warnings);
      setEngine("deterministic draw.io parser");
      setFileRef(file.name);
      if (!name) setName(file.name.replace(/\.(drawio|xml)$/i, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    }
  };

  const accept = () => {
    if (!graph) return;
    const project = createProject(name || "Imported architecture", source, graph, fileRef);
    navigate({ to: "/studio", search: { project: project.project_id } });
  };

  return (
    <AppShell
      title="Import & Reconstruction Review"
      subtitle="Imported XML, images and instructions are untrusted data: XML is parsed with a hardened reader (no DOCTYPE, no entities, no external references), images only ever produce a candidate graph, and text can never change how the product behaves. Review what was detected before anything animates."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FileCode2 className="h-4 w-4 text-primary" /> draw.io / mxGraph XML
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className="grid place-items-center rounded-xl border border-dashed border-border/70 bg-background/50 px-6 py-10 text-center"
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-xs text-muted-foreground">
              Drop an uncompressed .drawio / .xml file, or
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => fileInput.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".drawio,.xml,application/xml,text/xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="bg-input/60"
          />
        </Card>

        <Card className="space-y-3 p-5">
          <p className="flex items-center justify-between gap-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <ImageUp className="h-4 w-4 text-primary" /> Image + instructions reconstruction
            </span>
            <span className="chip">{entitlements.ai.provider ?? "AI engine"}</span>
          </p>
          {canReconstruct ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {entitlements.ai.provider?.startsWith("in-browser")
                  ? `${entitlements.ai.visionModel} runs in your browser and reads the diagram plus your notes; the image never leaves your device. The first run downloads the open-weight model (~360 MB) from this site.`
                  : `${entitlements.ai.visionModel} on ${entitlements.ai.provider} reads the diagram and your notes and proposes a graph.`}{" "}
                The image never drives the animation — only the graph you approve below does.
              </p>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void pickImage(file);
                }}
                className="grid place-items-center rounded-xl border border-dashed border-border/70 bg-background/50 px-6 py-6 text-center"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Selected architecture diagram"
                    className="max-h-40 rounded-md"
                  />
                ) : (
                  <ImageUp className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {imageFile ? imageFile.name : "Drop a PNG, JPG or WebP diagram, or"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => imageInput.current?.click()}
                >
                  {imageFile ? "Replace image" : "Choose image"}
                </Button>
                <input
                  ref={imageInput}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void pickImage(file);
                  }}
                />
              </div>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder="Instructions (optional with an image, required without): e.g. 'Treat the search icon as a retrieval service; the LLM streams tokens back to the UI over SSE; add an evaluator after generation.'"
                className="bg-input/50 text-xs"
              />
              <Button
                size="sm"
                disabled={busy || (!imageFile && !instructions.trim())}
                onClick={reconstruct}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {busy
                  ? "Reconstructing…"
                  : imageFile
                    ? "Reconstruct from image"
                    : "Compile from instructions"}
              </Button>
              <ModelStatus />
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The current AI engine has no vision model. Switch to the in-browser engine
                (SmolVLM-500M, open weights) or set a vision model for your endpoint in Settings.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => navigate({ to: "/settings" })}
              >
                <Settings2 className="h-3.5 w-3.5" /> Open Settings
              </Button>
            </>
          )}
        </Card>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {graph && <GraphReview graph={graph} warnings={warnings} engine={engine} onAccept={accept} />}
    </AppShell>
  );
}
