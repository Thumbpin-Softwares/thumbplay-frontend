"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { templateNotify as toast } from "@/modules/template/components/notification";
import { useAvatars } from "@/modules/common/hooks/useAvatars";
import { StepCapsule } from "@/modules/template/components/StepCapsule";
import { Breadcrumbs } from "@/modules/template/components/Breadcrumbs";
import { AddAssetsStep } from "@/modules/template/layout/AddAssetsStep";
import { StepScript } from "@/modules/template/layout/StepScript";
import { StepFinalize } from "@/modules/template/layout/StepFinalize";
import { StepGeneration } from "@/modules/template/layout/StepGeneration";
import { useModelTourVideoJob } from "@/modules/template-property-commercial/hooks/useModelTourVideoJob";
import { ModelTourPostProcess } from "@/modules/template-property-commercial/components/ModelTourPostProcess";
import { ModelTourGenerations } from "@/modules/template-property-commercial/components/ModelTourGenerations";
import { ModelTourFinalize } from "@/modules/template-property-commercial/components/ModelTourFinalize";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEP_LABELS = ["Add Assets", "Script", "Finalize", "Captions & Logo"];

// This template is a straight clone of template-property-commercial's n8n
// model-tour pipeline — same SiteForm fields, same finalize/post-process UI,
// same shared components/backend endpoints. The only thing that differs is
// which n8n workflow generates the script: we send `template: "luxury-car-exit"`
// in modelTourScriptRequest, and the backend (model-tour.service.ts's
// N8N_SCRIPT_WEBHOOKS map) routes that to this template's own webhook.
// Video-render and splitter/voice-change stages stay shared infra.
const MODEL_TOUR_CLASSIFICATIONS = new Set(["residential", "commercial", "plotted"]);

// Own sessionStorage keys — distinct from template-property-commercial's so
// the two templates don't clobber each other's in-progress form/job state
// if a user has both open (e.g. in different tabs).
const FORM_STATE_KEY = "luxury-car-exit-tour-form-state";
const JOB_ID_KEY = "luxury-car-exit-tour-job-id";

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

export default function LuxuryCarExitTourRunner({ template }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [scriptValues, setScriptValues] = useState({});
  const [generatingScript, setGeneratingScript] = useState(false);
  const [storyboard, setStoryboard] = useState(null);
  const [renderedFrames, setRenderedFrames] = useState(null);
  const [modelTourScript, setModelTourScript] = useState(null);
  const [generatingModelTourScript, setGeneratingModelTourScript] = useState(false);
  const videoJob = useModelTourVideoJob(JOB_ID_KEY);
  const [showGenerations, setShowGenerations] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const avatarHook = useAvatars();

  useEffect(() => {
    let savedScript = null;
    try {
      const raw = sessionStorage.getItem(FORM_STATE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.step === "number") setStep(saved.step);
        if (Array.isArray(saved.images)) setImages(saved.images);
        if (saved.scriptValues) setScriptValues(saved.scriptValues);
        if (saved.modelTourScript) {
          setModelTourScript(saved.modelTourScript);
          savedScript = saved.modelTourScript;
        }
        if (saved.avatarMode) avatarHook.setAvatarMode(saved.avatarMode);
        if (Array.isArray(saved.selectedAvatars)) avatarHook.setSelectedAvatars(saved.selectedAvatars);
        if (saved.selectedCollectionId) avatarHook.setSelectedCollectionId(saved.selectedCollectionId);
      }
      if (videoJob.resumeIfInFlight(savedScript)) setStep(3);
    } catch (_) {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || videoJob.phase !== "idle") return;
    try {
      sessionStorage.setItem(
        FORM_STATE_KEY,
        JSON.stringify({
          step,
          images,
          scriptValues,
          modelTourScript,
          avatarMode: avatarHook.avatarMode,
          selectedAvatars: avatarHook.selectedAvatars,
          selectedCollectionId: avatarHook.selectedCollectionId,
        })
      );
    } catch (_) {}
  }, [hydrated, videoJob.phase, step, images, scriptValues, modelTourScript, avatarHook.avatarMode, avatarHook.selectedAvatars, avatarHook.selectedCollectionId]);

  const uploadedImages = images.filter((img) => img.r2Url);
  const isValid =
    images.length >= 1 &&
    uploadedImages.length === images.length &&
    avatarHook.selectedAvatars.length >= 1;

  const isModelTourFlow = MODEL_TOUR_CLASSIFICATIONS.has(scriptValues.propertyClassification);

  const dataMaxStep = videoJob.phase !== "idle" ? 3 : modelTourScript || storyboard ? 2 : isValid ? 1 : 0;

  const scriptValuesWithImages = {
    ...scriptValues,
    propertyImages: uploadedImages.map((img) => img.r2Url),
    avatarImage: avatarHook.selectedAvatars[0]?.url,
  };

  const handleClear = () => {
    setImages([]);
    setScriptValues({});
    setModelTourScript(null);
    setStep(0);
    avatarHook.clearSelectedAvatars();
    try {
      sessionStorage.removeItem(FORM_STATE_KEY);
    } catch (_) {}
  };

  const generatingScriptRef = useRef(false);

  const handleGenerateScript = async () => {
    if (generatingScriptRef.current) return;
    generatingScriptRef.current = true;
    setGeneratingScript(true);
    try {
      const res = await fetch(`/api/template/generate-script/${template.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: scriptValuesWithImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setStoryboard(data.frames);
      setStep(2);
      toast.success("Storyboard generated!");
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
      generatingScriptRef.current = false;
    }
  };

  const isCommercial = scriptValues.propertyClassification === "commercial";
  const commercialDetails = [
    scriptValues.shopType && `Shop Type: ${scriptValues.shopType}`,
    scriptValues.footfall && `Footfall: ${scriptValues.footfall}`,
    scriptValues.brandRelationships && `Brand Relationships: ${scriptValues.brandRelationships}`,
    scriptValues.revenuePotential && `Revenue Potential: ${scriptValues.revenuePotential}`,
  ]
    .filter(Boolean)
    .join("; ");

  const isManualScript = scriptValues.scriptMode === "manual";

  // Only difference from template-property-commercial's request: `template:
  // "luxury-car-exit"` tells the backend which n8n script webhook to hit.
  const modelTourScriptRequest = isManualScript
    ? {
        propertyName: scriptValues.projectName || "",
        type: scriptValues.propertyClassification || undefined,
        template: "luxury-car-exit",
        language: scriptValues.language || "",
        tierClass: scriptValues.projectType || "",
        script: scriptValues.manualScript || "",
        avatarImageUrls: avatarHook.selectedAvatars.map((a) => a.url).slice(0, 4),
        propertyImageUrls: uploadedImages.map((img) => img.r2Url).slice(0, 4),
      }
    : {
        propertyName: scriptValues.projectName || "",
        type: scriptValues.propertyClassification || undefined,
        template: "luxury-car-exit",
        locationLandmarks: scriptValues.landmarks || "",
        connectivity: scriptValues.connectivity || "",
        language: scriptValues.language || "",
        tierClass: scriptValues.projectType || "",
        carpetArea: (isCommercial ? scriptValues.shopBuiltUpArea : scriptValues.carpetArea) || "",
        amenities: (isCommercial ? commercialDetails : scriptValues.amenities) || "",
        tonality: scriptValues.tonality || "",
        vibe: scriptValues.vibe || "",
        avatarImageUrls: avatarHook.selectedAvatars.map((a) => a.url).slice(0, 4),
        propertyImageUrls: uploadedImages.map((img) => img.r2Url).slice(0, 4),
      };

  const handleGenerateModelTourScript = async () => {
    setGeneratingModelTourScript(true);
    try {
      const res = await fetch("/api/model-tour/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelTourScriptRequest),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "Script generation failed");

      const { jobId } = data;
      let script = null;
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const jobRes = await fetch(`/api/model-tour/jobs/${jobId}`);
        const { job } = await parseJsonSafe(jobRes);
        if (!jobRes.ok) throw new Error(`Lost track of the script job: ${jobRes.status}`);
        if (job.status === "done") {
          script = job.result;
          break;
        }
        if (job.status === "error") throw new Error(job.error || "Script generation failed");
      }

      setModelTourScript(script);
      setStep(2);

      const credits = script?.creditsCharged;
      if (credits != null) {
        toast.success("Script generated", {
          description: `${credits} credit${credits !== 1 ? "s" : ""} deducted.`,
          action: {
            label: "View history",
            onClick: () => router.push("/dashboard/credits"),
          },
        });
      }
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingModelTourScript(false);
    }
  };

  const handleContinueFromScript = () => {
    if (MODEL_TOUR_CLASSIFICATIONS.has(scriptValues.propertyClassification)) {
      handleGenerateModelTourScript();
    } else {
      handleGenerateScript();
    }
  };

  const handleConfirmGenerate = () => {
    try {
      sessionStorage.removeItem(FORM_STATE_KEY);
    } catch (_) {}
    videoJob.start(modelTourScript);
    setStep(3);
  };

  return (
    <div className="h-full w-full max-w-none 2xl:max-w-5xl mx-auto px-4 py-12 flex flex-col animate-fade-in">
      <div className="shrink-0 flex items-center justify-between gap-2">
        <Breadcrumbs template={template} />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowGenerations(true)}>
          <History className="w-3.5 h-3.5" />
          My Generations
        </Button>
      </div>
      <ModelTourGenerations open={showGenerations} onOpenChange={setShowGenerations} />

      {step < (isModelTourFlow ? 4 : 3) && (
        <div className="shrink-0 flex justify-start overflow-x-auto scrollbar-hide py-3">
          <StepCapsule
            currentStep={step}
            steps={template.steps || STEP_LABELS}
            maxStep={dataMaxStep}
            onStepClick={setStep}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="min-h-full flex flex-col justify-center px-2 sm:px-6 lg:px-7 py-4 pb-20 md:pb-4">
          {step === 0 && (
            <AddAssetsStep
              images={images}
              setImages={setImages}
              avatarHook={avatarHook}
              isValid={isValid}
              onNext={() => setStep(1)}
              onClear={handleClear}
              prebuiltLabel="RE Agents"
              propertyUploadEndpoint="/api/model-tour/upload/property"
            />
          )}

          {step === 1 && (
            <StepScript
              values={scriptValuesWithImages}
              onChange={({ propertyImages, avatarImage, ...rest }) => setScriptValues(rest)}
              onBack={() => setStep(0)}
              onNext={handleContinueFromScript}
              loading={generatingScript || generatingModelTourScript}
              continueLabel={
                MODEL_TOUR_CLASSIFICATIONS.has(scriptValues.propertyClassification)
                  ? "Review & Finalize"
                  : "Generate Storyboard"
              }
            />
          )}

          {step === 2 && MODEL_TOUR_CLASSIFICATIONS.has(scriptValues.propertyClassification) && (
            <ModelTourFinalize
              images={images}
              selectedAvatars={avatarHook.selectedAvatars}
              script={modelTourScript}
              onChange={setModelTourScript}
              onBack={() => setStep(1)}
              onGenerate={handleConfirmGenerate}
            />
          )}

          {step === 2 && !MODEL_TOUR_CLASSIFICATIONS.has(scriptValues.propertyClassification) && (
            <StepFinalize
              template={template}
              storyboard={storyboard}
              images={images}
              selectedAvatars={avatarHook.selectedAvatars}
              scriptValues={scriptValues}
              onBack={() => setStep(1)}
              onContinue={(frames) => {
                setRenderedFrames(frames);
                setStep(3);
              }}
            />
          )}

          {step === 3 && isModelTourFlow && (
            <ModelTourPostProcess
              jobPhase={videoJob.phase}
              jobError={videoJob.error}
              resultUrl={videoJob.resultUrl}
              onRetryJob={videoJob.retry}
              onStartOver={() => {
                videoJob.abort();
                setStep(2);
              }}
              onBack={() => setStep(2)}
            />
          )}

          {step === 3 && !isModelTourFlow && (
            <StepGeneration
              template={template}
              renderedFrames={renderedFrames}
              onAbort={() => setStep(2)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
