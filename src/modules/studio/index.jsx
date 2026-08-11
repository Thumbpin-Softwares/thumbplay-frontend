"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Video, Mic, Image as ImageIcon } from "lucide-react";
import { PromptComposer } from "./components/PromptComposer";
import { StudioGenerations } from "./components/StudioGenerations";
import { useStudioJobs } from "./hooks/useStudioJobs";

// Only "drone-flythrough" is wired to a real backend pipeline right now -
// the other two are shown as disabled chips so the work-type-picker UX is
// visible up front, without pretending those pipelines exist yet.
const WORK_TYPES = [
  {
    key: "drone-flythrough",
    label: "Cinematic Drone Flythrough",
    icon: Video,
    placeholder:
      "Optional - e.g. \"orbit slowly around the east wing\" or \"emphasize the rooftop pool\"…",
    creditCost: 3,
    disabled: false,
  },
  {
    key: "avatar-speaking",
    label: "Avatar Speaking",
    icon: Mic,
    placeholder: "",
    creditCost: null,
    disabled: true,
  },
  {
    key: "virtual-staging",
    label: "Virtual Staging",
    icon: ImageIcon,
    placeholder: "",
    creditCost: null,
    disabled: true,
  },
];

export default function Studio() {
  const [activeWorkType, setActiveWorkType] = useState(WORK_TYPES[0].key);
  const { jobs, loading, error, submitting, submit } = useStudioJobs();

  const active = WORK_TYPES.find((w) => w.key === activeWorkType) || WORK_TYPES[0];

  const handleSubmit = async (payload) => {
    const result = await submit(payload);
    if (result.ok) {
      toast.success("Generation started - it'll show up below when it's ready.");
    } else {
      toast.error("Failed to start generation", { description: result.error });
    }
    return result;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-medium">Studio</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Describe what you want, attach reference photos, and pick which model does the work.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORK_TYPES.map((w) => (
          <button
            key={w.key}
            type="button"
            disabled={w.disabled}
            onClick={() => setActiveWorkType(w.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              w.disabled
                ? "border-neutral-200 text-neutral-400 cursor-not-allowed"
                : activeWorkType === w.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
            }`}
          >
            <w.icon className="w-3.5 h-3.5" />
            {w.label}
            {w.disabled && <span className="text-[10px] opacity-70">Soon</span>}
          </button>
        ))}
      </div>

      <PromptComposer
        key={active.key}
        workType={active.key}
        creditCost={active.creditCost}
        submitting={submitting}
        onSubmit={handleSubmit}
        placeholder={active.placeholder}
      />

      <div>
        <h2 className="text-sm font-medium text-neutral-700 mb-3">Your Generations</h2>
        <StudioGenerations jobs={jobs} loading={loading} error={error} />
      </div>
    </div>
  );
}
