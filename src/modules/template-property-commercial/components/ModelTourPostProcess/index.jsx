"use client";

import { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { Captions, ChevronLeft, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GenerationProgressShell } from "@/modules/common/components/generation-progress-shell";
import { CaptionsPanel } from "@/modules/edit/components/caption-panel";
import { OverlaysPanel } from "@/modules/edit/components/overlays-panel";
import { OverlaysCanvasLayer } from "@/modules/edit/components/overlays-canvas-layer";
import { ActionReelComposition, calcActionReelDurationInFrames } from "@/lib/remotion/ActionReelComposition";
import { getVideoDuration } from "@/lib/editable-sources";
import { CAPTION_PRESETS } from "@/lib/remotion/caption-presets";
import { computeCaptionCreditCost } from "@/lib/credit-costs";
import { notifyCreditsChanged } from "@/hooks/use-user";

const FPS = 30;

// Plain-<img> stand-in for the logo overlay, used while the base video is
// still generating and the real Player/ActionReelComposition (which is what
// actually draws overlays once mounted) isn't up yet - without this, picking
// a logo before the video finishes rendered no preview at all, since the
// canvas was just a loading spinner.
function LogoPreview({ overlays }) {
  return overlays
    .filter((o) => !o.hidden)
    .map((o) => (
      <img
        key={o.id}
        src={o.url}
        alt=""
        className="absolute pointer-events-none"
        style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.width}%`, transform: "translate(-50%, -50%)" }}
      />
    ));
}

function createLogoOverlay(url) {
  return {
    id: `logo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "image",
    x: 82,
    y: 12,
    width: 22,
    url,
    aspect: null,
    hidden: false,
  };
}

// Step 4 of the model-tour flow - shown right after Finalize kicks off the
// background n8n render (jobPhase comes from useModelTourVideoJob, still
// polling underneath this screen). The user can pick a caption style and
// place a logo *while* the base video is still generating; both choices are
// only staged (nothing is sent to the server) until the base video is ready
// and they click Generate, which bakes the logo in via the same
// /api/exports/render-remotion route every other reopened model-tour clip
// uses, then runs the (possibly staged) caption choice through the same
// /api/captions/generate call the main Editor uses.
export function ModelTourPostProcess({ jobPhase, jobError, resultUrl, onRetryJob, onStartOver, onBack }) {
  const [probedDuration, setProbedDuration] = useState(0);
  useEffect(() => {
    if (!resultUrl) return;
    let cancelled = false;
    getVideoDuration(resultUrl).then((d) => {
      if (!cancelled) setProbedDuration(d > 0 ? d : 15);
    });
    return () => {
      cancelled = true;
    };
  }, [resultUrl]);

  const [activePanel, setActivePanel] = useState(null); // "captions" | "logo" | null
  const [captionChoice, setCaptionChoice] = useState(null); // { presetId, language, translateTo, position }
  const [captionDraft, setCaptionDraft] = useState(null);

  const [overlays, setOverlays] = useState([]); // logo only, 0 or 1 image overlay in practice
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [overlayUploading, setOverlayUploading] = useState(false);
  const canvasBoxRef = useRef(null);

  const [finalPhase, setFinalPhase] = useState("idle"); // idle | baking | captioning | done | error
  const [finalError, setFinalError] = useState(null);
  const [finalUrl, setFinalUrl] = useState(null);

  const durationInFrames = calcActionReelDurationInFrames({
    part1Duration: probedDuration || 15,
    part2Duration: 0,
    cutRanges: [],
  });

  const handleAddLogo = async (file) => {
    setOverlayUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", "Logo overlay");
      formData.append("type", "overlay");
      formData.append("category", "overlays");

      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const overlay = createLogoOverlay(data.asset.url);
      // One logo at a time - a second upload replaces the first rather than stacking.
      setOverlays([overlay]);
      setSelectedOverlayId(overlay.id);
    } catch (err) {
      console.error("[ModelTourPostProcess] Logo upload failed:", err);
      toast.error("Logo upload failed", { description: err.message });
    } finally {
      setOverlayUploading(false);
    }
  };

  const handleUpdateOverlay = (id, patch) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const handleMoveOverlay = (id, { x, y }) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)));
  };
  const handleRemoveOverlay = (id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((prev) => (prev === id ? null : prev));
  };
  const handleToggleOverlayHidden = (id) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, hidden: !o.hidden } : o)));
  };

  const readSseStream = async (res, onEvent) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event;
        try {
          event = JSON.parse(line.slice(6));
        } catch (_) {
          continue;
        }
        onEvent(event);
      }
    }
  };

  const handleGenerate = async () => {
    if (finalPhase === "baking" || finalPhase === "captioning") return;
    setFinalError(null);

    try {
      let videoUrl = resultUrl;

      if (overlays.length > 0) {
        setFinalPhase("baking");
        const res = await fetch("/api/exports/render-remotion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "model-tour",
            part1VideoUrl: resultUrl,
            part1Duration: probedDuration || 15,
            part2VideoUrl: "",
            part2Duration: 0,
            overlays,
            musicUrl: "",
            musicVolume: 0.25,
            musicTrimStartSeconds: 0,
            cutRanges: [],
            trimInFrame: 0,
            trimOutFrame: durationInFrames,
          }),
        });
        if (!res.ok) throw new Error(`Render failed: ${res.status}`);

        let bakedUrl = null;
        await readSseStream(res, (event) => {
          if (event.type === "done") bakedUrl = event.url;
          if (event.type === "error") throw new Error(event.error);
        });
        if (!bakedUrl) throw new Error("No URL returned from render");
        videoUrl = bakedUrl;
      }

      if (captionChoice) {
        setFinalPhase("captioning");
        const capRes = await fetch("/api/captions/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl,
            preset: captionChoice.presetId,
            language: captionChoice.language || undefined,
            translationLanguage: captionChoice.translateTo || undefined,
            position: captionChoice.position || undefined,
            durationSeconds: probedDuration || 0,
          }),
        });
        const capData = await capRes.json();
        if (!capRes.ok) throw new Error(capData.error || `Captioning failed: ${capRes.status}`);
        videoUrl = capData.url;
        notifyCreditsChanged();
      }

      setFinalUrl(videoUrl);
      setFinalPhase("done");
    } catch (err) {
      console.error("[ModelTourPostProcess] Generate failed:", err);
      setFinalError(err.message || "Something went wrong");
      setFinalPhase("error");
    }
  };

  const handleDownload = () => {
    if (!finalUrl) return;
    window.location.href = `/api/download?url=${encodeURIComponent(finalUrl)}&name=${encodeURIComponent("home-tour.mp4")}`;
  };

  const selectedPreset = captionChoice ? CAPTION_PRESETS.find((p) => p.id === captionChoice.presetId) : null;
  const estimatedCredits = captionChoice
    ? computeCaptionCreditCost({
        durationSeconds: probedDuration || 0,
        isDynamicPreset: selectedPreset?.tier === "dynamic",
        hasTranslation: !!captionChoice.translateTo,
      }).credits
    : 0;

  if (finalPhase === "done") {
    return (
      <GenerationProgressShell
        phase="done"
        doneText="Your home tour video is ready!"
        onDownload={handleDownload}
        onOpenEditor={onBack}
        openEditorText="Back to form"
        downloadText="Download video"
      />
    );
  }

  const videoNotReady = jobPhase !== "done";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Fixed height so the right panel's overflow-y-auto actually clips
          instead of growing the whole page - a flex row with no bounded
          height has nothing for "auto" to clip against. */}
      <div className="flex gap-4 h-130">
        {/* Canvas */}
        <div className="flex-1 h-full flex flex-col items-center justify-center gap-2 min-h-0">
          <div
            ref={canvasBoxRef}
            className="relative w-full max-w-[220px] mx-auto rounded-xl overflow-hidden border border-border/50 bg-black shadow-xl"
            style={{ aspectRatio: "9/16" }}
          >
            {videoNotReady ? (
              <>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  {jobPhase === "error" ? (
                    <>
                      <p className="text-xs text-white/70">{jobError}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={onRetryJob}
                          className="rounded-lg border border-white/30 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                        >
                          Retry
                        </button>
                        {onStartOver && (
                          <button
                            onClick={onStartOver}
                            className="rounded-lg border border-white/30 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                          >
                            Start Over
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <p className="text-xs font-medium text-white">Generating your home tour video…</p>
                    </>
                  )}
                </div>
                <LogoPreview overlays={overlays} />
              </>
            ) : (
              <Player
                component={ActionReelComposition}
                inputProps={{ part1VideoUrl: resultUrl, part1Duration: probedDuration || 15, overlays }}
                durationInFrames={durationInFrames}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={FPS}
                style={{ width: "100%", height: "100%", display: "block" }}
                loop
                clickToPlay
              />
            )}

            {/* Drag layer, caption position preview, and final-bake spinner -
                all shown regardless of whether the base video has finished,
                so staging a logo/caption choice always has visible feedback. */}
            {activePanel === "logo" && (
              <OverlaysCanvasLayer
                containerRef={canvasBoxRef}
                overlays={overlays.filter((o) => !o.hidden)}
                selectedId={selectedOverlayId}
                editingId={null}
                onSelect={setSelectedOverlayId}
                onMove={handleMoveOverlay}
                onLoadAspect={(id, aspect) => handleUpdateOverlay(id, { aspect })}
                onStartEdit={() => {}}
                onEditChange={() => {}}
                onStopEdit={() => {}}
              />
            )}
            {captionDraft && (
              <div
                className={`absolute inset-x-0 flex px-4 pointer-events-none ${
                  captionDraft.position === "top"
                    ? "top-6 justify-center"
                    : captionDraft.position === "center"
                    ? "inset-y-0 items-center justify-center"
                    : "bottom-6 justify-center"
                }`}
              >
                <span className="rounded-sm bg-black/50 px-3 py-1.5 text-xs text-white text-center">
                  Your captions here
                </span>
              </div>
            )}
            {(finalPhase === "baking" || finalPhase === "captioning") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-xs font-medium text-white">
                  {finalPhase === "baking" ? "Adding your logo…" : "Adding captions…"}
                </p>
              </div>
            )}
          </div>
          {finalPhase === "error" && <p className="text-xs text-destructive text-center max-w-[280px]">{finalError}</p>}
        </div>

        {/* Right panel */}
        <div className="w-72 h-full shrink-0 border border-border/50 rounded-xl bg-white flex flex-col overflow-hidden">
          {activePanel ? (
            <>
              <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40 shrink-0">
                <button
                  onClick={() => setActivePanel(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold capitalize">{activePanel}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                {activePanel === "captions" && (
                  <CaptionsPanel
                    captionState={{ status: "idle" }}
                    mode="select"
                    selectedPresetId={captionChoice?.presetId ?? null}
                    actionLabel="Use this style"
                    onGenerate={(presetId, language, translateTo, position) => {
                      setCaptionChoice({ presetId, language, translateTo, position });
                      setActivePanel(null);
                    }}
                    onReset={() => setCaptionChoice(null)}
                    onDraftChange={setCaptionDraft}
                    reelDurationSeconds={probedDuration || 0}
                  />
                )}
                {activePanel === "logo" && (
                  <OverlaysPanel
                    imageOnly
                    overlays={overlays}
                    selectedId={selectedOverlayId}
                    onSelect={setSelectedOverlayId}
                    onAddImage={handleAddLogo}
                    onUpdate={handleUpdateOverlay}
                    onRemove={handleRemoveOverlay}
                    onToggleHidden={handleToggleOverlayHidden}
                    onReorder={setOverlays}
                    uploading={overlayUploading}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/40 shrink-0">
                <span className="text-sm text-black">Captions & Logo</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
                {[
                  {
                    id: "captions",
                    label: "Captions",
                    Icon: Captions,
                    desc: captionChoice ? `Selected: ${CAPTION_PRESETS.find((p) => p.id === captionChoice.presetId)?.label || ""}` : "Pick a caption style",
                  },
                  {
                    id: "logo",
                    label: "Logo",
                    Icon: ImagePlus,
                    desc: overlays.length > 0 ? "Logo added" : "Add and place your logo",
                  },
                ].map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setActivePanel(id)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border transition-colors text-left w-full"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#c7f038]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Back
        </button>

        <button
          onClick={handleGenerate}
          disabled={videoNotReady || finalPhase === "baking" || finalPhase === "captioning"}
          className="flex items-center gap-2 rounded-full bg-neutral-900 text-[#c7f038] px-6 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {videoNotReady ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for video…
            </>
          ) : finalPhase === "baking" || finalPhase === "captioning" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {finalPhase === "baking" ? "Adding logo…" : "Adding captions…"}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate{estimatedCredits > 0 ? ` · ${estimatedCredits} credit${estimatedCredits === 1 ? "" : "s"}` : ""}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
