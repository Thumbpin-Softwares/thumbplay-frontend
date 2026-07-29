"use client";

import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteForm, isSiteFormValid } from "@/modules/template/components/SiteForm";
import { CREDIT_ACTIONS } from "@/lib/credit-costs";

// Flat display estimate for the script-generation webhook call every
// template's Script step fires — the real infra cost is a fraction of a
// credit ($0.0004-0.0006), so this is a rounded-up preview number rather
// than something computed per job.
const SCRIPT_GENERATION_ESTIMATED_COST = CREDIT_ACTIONS.model_tour_script_generation.cost;

// Step 1 for every template's pipeline: the site-details form + speaker
// language. A template just supplies its own `values`/`onChange` state;
// validation defaults to the shared required-field rules (SiteForm's
// required fields, plus a language pick) but can be overridden via
// `isValid` if a template ever needs stricter checks. `onNext` may be async
// (e.g. it calls the script-generation API) — pass `loading` while it's in
// flight to disable the button and swap its label.
export function StepScript({
  values,
  onChange,
  onBack,
  onNext,
  isValid,
  loading = false,
  continueLabel = "Continue to Finalize",
  loadingLabel = "Generating...",
}) {
  const valid = isValid ?? (isSiteFormValid(values) && (values.scriptMode === "manual" || !!values.language));

  return (
    <div className="space-y-5 animate-fade-in">
      <SiteForm values={values} onChange={onChange} />

      <div className="flex flex-col items-end gap-1.5 pt-2">
        <p className="text-[11px] text-neutral-400">
          Estimated cost: <span className="font-medium text-neutral-600">{SCRIPT_GENERATION_ESTIMATED_COST} credits</span>
        </p>

        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={onBack} disabled={loading} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          <Button
            onClick={onNext}
            disabled={!valid || loading}
            className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {loadingLabel}
              </>
            ) : (
              <>
                {continueLabel}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
