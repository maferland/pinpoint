import { useEffect, useMemo, useState } from "react";
import { decryptBundle, encryptWithKey } from "./share-crypto.ts";
import { fetchBundle, parseShareLink, uploadResponse, type ShareLink } from "./share-transport.ts";
import { readZip, writeZip } from "./zip.ts";
import { parseContext } from "./context.ts";
import { CanvasLayer } from "./canvas-layer.tsx";
import { CommentsRail } from "./comments-rail.tsx";
import { useAnnotationEditor } from "./use-annotation-editor.ts";
import { AttachmentSourceContext } from "./attachment-source.ts";
import { Button } from "./ui/index.tsx";
import type { PinpointAnnotation } from "./types.ts";

interface BundleManifest {
  id: string;
  context?: string;
  annotations: PinpointAnnotation[];
  images: { name: string; mime: string; width: number; height: number }[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; manifest: BundleManifest; imageBytes: Map<string, Uint8Array>; imageUrl: string; attachmentUrls: Map<string, string> }
  | { status: "sent" };

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function decodeManifest(zip: Uint8Array) {
  const entries = readZip(zip);
  const manifestEntry = entries.find((e) => e.name === "review.json");
  if (!manifestEntry) throw new Error("Shared bundle is missing its manifest");
  const manifest = JSON.parse(textDecoder.decode(manifestEntry.data)) as BundleManifest;
  const imageBytes = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.name !== "review.json") imageBytes.set(entry.name, entry.data);
  }
  return { manifest, imageBytes };
}

export function ShareView() {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [sending, setSending] = useState(false);
  const { annotations, setAnnotations, selectedId, setSelectedId, addAnnotation, updateAnnotation, removeAnnotation } =
    useAnnotationEditor([]);

  useEffect(() => {
    try {
      setLink(parseShareLink(window.location.href));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "This isn't a valid pinpoint share link.");
    }
  }, []);

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = link.tier === "inline" ? link.payload : await fetchBundle(link.shareId);
        const zipBytes = await decryptBundle(payload, link.key);
        const { manifest, imageBytes } = decodeManifest(zipBytes);
        const firstImage = manifest.images[0];
        if (!firstImage) throw new Error("Shared review has no images");
        const bytes = imageBytes.get(firstImage.name);
        if (!bytes) throw new Error("Shared review is missing its image data");
        const blob = new Blob([bytes as BlobPart], { type: firstImage.mime });
        const attachmentUrls = new Map<string, string>();
        for (const ann of manifest.annotations) {
          for (const att of ann.attachments ?? []) {
            const attBytes = imageBytes.get(`attachments/${ann.id}-${att.id}`);
            if (attBytes) attachmentUrls.set(att.id, URL.createObjectURL(new Blob([attBytes as BlobPart])));
          }
        }
        if (cancelled) return;
        setAnnotations(manifest.annotations);
        setState({ status: "ready", manifest, imageBytes, imageUrl: URL.createObjectURL(blob), attachmentUrls });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Failed to open this review" });
      }
    })();
    return () => { cancelled = true; };
  }, [link, setAnnotations]);

  const send = async () => {
    if (state.status !== "ready" || !link) return;
    setSending(true);
    try {
      const responseManifest = { ...state.manifest, annotations };
      const zip = writeZip([
        { name: "review.json", data: textEncoder.encode(JSON.stringify(responseManifest)) },
        ...[...state.imageBytes.entries()].map(([name, data]) => ({ name, data })),
      ]);
      const encrypted = await encryptWithKey(zip, link.responseKey);
      await uploadResponse(link.shareId, encrypted);
      setState({ status: "sent" });
    } catch (err) {
      setSending(false);
      alert(err instanceof Error ? err.message : "Sending your feedback failed. Try again.");
    }
  };

  const ctx = useMemo(
    () => (state.status === "ready" ? parseContext(state.manifest.context) : null),
    [state]
  );

  const attachmentSource = useMemo(() => {
    const urls = state.status === "ready" ? state.attachmentUrls : new Map<string, string>();
    return { srcFor: (_reviewId: string, id: string) => urls.get(id) ?? "", canEdit: false };
  }, [state]);

  if (linkError) {
    return <Centered>{linkError}</Centered>;
  }
  if (state.status === "loading") {
    return <Centered>Decrypting…</Centered>;
  }
  if (state.status === "error") {
    return <Centered>{state.message}</Centered>;
  }
  if (state.status === "sent") {
    return <Centered>Sent — you can close this tab.</Centered>;
  }

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center px-4 gap-3 bg-surface border-b border-border shrink-0" style={{ height: 56 }}>
        <div className="rounded-full shrink-0" style={{ width: 11, height: 11, backgroundColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-soft)" }} />
        <span className="font-mono text-[13px] font-semibold text-txt">pinpoint</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-txt truncate">{ctx?.message ?? "Shared review"}</p>
        </div>
        <Button variant="accent" size="md" onClick={send} disabled={sending}>
          {sending ? "Sending…" : `Send ${annotations.length} comment${annotations.length === 1 ? "" : "s"}`}
        </Button>
      </div>
      <AttachmentSourceContext.Provider value={attachmentSource}>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative flex flex-col">
            <CanvasLayer
              reviewId={state.manifest.id}
              imageDataUrl={state.imageUrl}
              annotations={annotations}
              selectedId={selectedId}
              viewMode="fit"
              onBoxPlace={(x, y, w, h) => addAnnotation({ x, y, width: w, height: h })}
              onSelect={setSelectedId}
              onUpdate={updateAnnotation}
              onDelete={removeAnnotation}
            />
          </div>
          <CommentsRail
            reviewId={state.manifest.id}
            annotations={annotations}
            selectedId={selectedId}
            context={state.manifest.context}
            onSelect={setSelectedId}
          />
        </div>
      </AttachmentSourceContext.Provider>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex items-center justify-center bg-bg text-muted text-[13px] px-6 text-center">
      {children}
    </div>
  );
}
