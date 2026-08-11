"use client";

import { PlayCircle, AlertCircle, Clock } from "lucide-react";

const STATUS_META = {
  running: { label: "Generating…", icon: Clock, className: "text-amber-500" },
  done: { label: "Ready", icon: PlayCircle, className: "text-emerald-500" },
  error: { label: "Failed", icon: AlertCircle, className: "text-destructive" },
};

// Prompt is optional now (see PromptComposer) - most jobs won't have one, so
// the card needs a sensible title to fall back to instead of blank text.
const WORK_TYPE_LABELS = {
  "drone-flythrough": "Cinematic Drone Flythrough",
};

function GenerationCard({ job }) {
  const meta = STATUS_META[job.status] || STATUS_META.running;
  const Icon = meta.icon;
  const title = job.prompt?.trim() || WORK_TYPE_LABELS[job.workType] || "Studio generation";

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
      <div className="aspect-video bg-neutral-100 flex items-center justify-center">
        {job.status === "done" && job.resultUrl ? (
          <video src={job.resultUrl} className="w-full h-full object-cover" controls />
        ) : (
          <Icon className={`w-8 h-8 ${meta.className} ${job.status === "running" ? "animate-pulse" : ""}`} />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium line-clamp-2">{title}</p>
        <p className={`text-xs mt-1 ${meta.className}`}>{meta.label}</p>
        {job.status === "error" && job.error && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{job.error}</p>
        )}
      </div>
    </div>
  );
}

// Inline grid (not a Dialog like ModelTourGenerations) - this IS the page's
// primary content, powering the "close the tab, come back later" pattern:
// reads GET /studio/generations, which stays accurate regardless of whether
// the tab that created a job is still open.
export function StudioGenerations({ jobs, loading, error }) {
  if (loading) {
    return <p className="text-center text-sm text-muted-foreground py-10">Loading your generations…</p>;
  }
  if (error) {
    return <p className="text-center text-sm text-destructive py-10">{error}</p>;
  }
  if (jobs.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-10">
        No generations yet - submit a prompt above to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {jobs.map((job) => (
        <GenerationCard key={job._id || job.jobId} job={job} />
      ))}
    </div>
  );
}
