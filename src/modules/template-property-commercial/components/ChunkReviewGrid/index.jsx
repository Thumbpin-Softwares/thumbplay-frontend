"use client";

import { Download, Loader2, RotateCcw, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function ChunkTile({ chunk, onRegenerate }) {
  const isRegenerating = chunk.status === "regenerating";
  const isError = chunk.status === "error";
  // A chunk that failed on the very first generation attempt has no url at
  // all, distinct from one that failed on a later regenerate (which keeps
  // its last-good url and just gets a corner badge) - each needs its own
  // placeholder rather than both silently falling through to a blank box.
  const neverSucceeded = isError && !chunk.url;

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
      <div className="relative aspect-9/16 bg-neutral-950 flex items-center justify-center">
        {chunk.url && !isRegenerating && (
          <video src={chunk.url} className="absolute inset-0 w-full h-full object-cover" controls />
        )}
        {neverSucceeded && !isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-[11px] text-white/80">Generation failed</p>
          </div>
        )}
        {isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <p className="text-[11px] text-white">Regenerating…</p>
          </div>
        )}
        {isError && !neverSucceeded && !isRegenerating && (
          <div className="absolute top-2 right-2 text-destructive bg-white rounded-full p-1">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-medium bg-black/60 text-white rounded-full px-2 py-0.5">
          Scene {chunk.index}
        </span>
      </div>
      <div className="p-2 flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="flex-1" disabled={isRegenerating} onClick={() => onRegenerate(chunk.index)}>
          <RotateCcw className="w-3.5 h-3.5" /> {neverSucceeded ? "Retry" : "Regenerate"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isRegenerating || !chunk.url} asChild={!isRegenerating && !!chunk.url}>
          {!isRegenerating && chunk.url ? (
            <a href={chunk.url} download target="_blank" rel="noreferrer">
              <Download className="w-3.5 h-3.5" />
            </a>
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Shown once all 6 scene clips are generated (job.phase === "chunks_ready"),
// before they're combined into the final video - lets the user catch a bad
// chunk (hallucination, bad lip-sync, etc.) and regenerate just that one
// instead of redoing the whole video. Export is disabled while any chunk is
// mid-regeneration so combine() never runs against a stale/in-flight URL.
export function ChunkReviewGrid({ chunks, onRegenerate, onCombine, onBack }) {
  const anyRegenerating = chunks.some((c) => c.status === "regenerating");
  const anyError = chunks.some((c) => c.status === "error");
  const failedCount = chunks.filter((c) => c.status === "error").length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-sm font-medium">Review your 6 scenes</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Not happy with a scene? Regenerate just that one. Download any clip individually, or combine them into the final video when you&apos;re ready.
        </p>
        {failedCount > 0 && (
          <p className="text-xs text-destructive mt-1">
            {failedCount} scene{failedCount === 1 ? "" : "s"} failed to generate — retry {failedCount === 1 ? "it" : "them"} before exporting.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {chunks.map((chunk) => (
          <ChunkTile key={chunk.index} chunk={chunk} onRegenerate={onRegenerate} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex flex-col items-end gap-1">
          <Button size="lg" disabled={anyRegenerating || anyError} onClick={onCombine}>
            <Sparkles className="w-4 h-4" />
            Export Combined Video
          </Button>
          {(anyRegenerating || anyError) && (
            <p className="text-[11px] text-muted-foreground">
              {anyError ? "Retry the failed scene(s) first" : "Waiting for regeneration to finish"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
