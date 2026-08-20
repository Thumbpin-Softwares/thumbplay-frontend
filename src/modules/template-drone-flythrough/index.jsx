"use client";

import { toast } from "sonner";
import { PromptComposer } from "@/modules/studio/components/PromptComposer";
import { StudioGenerations } from "@/modules/studio/components/StudioGenerations";
import { useStudioJobs } from "@/modules/studio/hooks/useStudioJobs";

const WORK_TYPE = "drone-flythrough";
const CREDIT_COST = 3;

// Single-shot template (no multi-step wizard) - attach photos, optionally
// describe the property and set per-generation branding, generate. Reuses
// the same PromptComposer/StudioGenerations/useStudioJobs that used to live
// under the standalone "Studio" page - that page is gone, this is now a
// normal template in the dashboard's catalog (see lib/templates.js +
// template-runner/runners.js) alongside model-tour/luxury-car-exit.
export default function DroneFlythroughTemplate() {
  const { jobs, loading, error, submitting, submit } = useStudioJobs();

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
        <h1 className="text-2xl font-medium">Cinematic Drone Flythrough</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Attach reference photos of the property - the camera glides in through the entrance and flows from room to
          room, all in one smooth take with punchy background music.
        </p>
      </div>

      <PromptComposer
        workType={WORK_TYPE}
        creditCost={CREDIT_COST}
        submitting={submitting}
        onSubmit={handleSubmit}
        placeholder='Optional - e.g. "glide from the entrance into the living room, then the dining area" or "emphasize the rooftop pool"…'
        showBranding
      />

      <div>
        <h2 className="text-sm font-medium text-neutral-700 mb-3">Your Generations</h2>
        <StudioGenerations jobs={jobs} loading={loading} error={error} />
      </div>
    </div>
  );
}
