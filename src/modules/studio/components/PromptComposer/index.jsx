"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BrandingFields } from "@/modules/dashboard/components/branding-fields";

const MAX_IMAGES = 4;

// Same upload endpoint/response shape as creative-ad-generator's uploadImage
// - property photos already land in the shared Asset library through it.
async function uploadImage(file, name) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  const res = await fetch("/api/model-tour/upload/property", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.asset?.url) throw new Error(data.error || "Upload failed");
  return data.asset.url;
}

// Higgsfield-style composer: one box holding the prompt textarea plus inline
// image chips, rather than a separate upload grid below the form.
export function PromptComposer({ workType, creditCost, submitting, onSubmit, placeholder, showBranding = false }) {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState([]);
  const [branding, setBranding] = useState({});
  const fileInputRef = useRef(null);

  const addImages = async (files) => {
    const remaining = MAX_IMAGES - images.length;
    const toAdd = Array.from(files).slice(0, Math.max(0, remaining));
    for (const file of toAdd) {
      const previewUrl = URL.createObjectURL(file);
      const entry = { id: crypto.randomUUID(), previewUrl, name: file.name, uploading: true, r2Url: null, error: null };
      setImages((prev) => [...prev, entry]);
      try {
        const url = await uploadImage(file, "Studio Reference Photo");
        setImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, uploading: false, r2Url: url } : img)));
      } catch (err) {
        setImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, uploading: false, error: err.message } : img)));
      }
    }
  };

  const uploadedUrls = images.filter((img) => img.r2Url).map((img) => img.r2Url);
  const hasUploading = images.some((img) => img.uploading);
  // Prompt is optional - the backend already has a tuned master prompt per
  // work type; this is just extra direction on top of it. Only the photos
  // are actually required.
  const canSubmit = uploadedUrls.length >= 1 && !hasUploading && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const result = await onSubmit({ workType, prompt: prompt.trim(), imageUrls: uploadedUrls, branding });
    if (result?.ok) {
      setPrompt("");
      setImages([]);
      setBranding({});
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-3 flex flex-col gap-3">
      <p className="text-xs text-neutral-400 px-1">Prompt (optional) - we already know how to shoot this, add direction only if you want something specific.</p>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="border-none shadow-none resize-none focus-visible:ring-0 px-1"
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {images.map((img) => (
            <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={img.name} className="absolute inset-0 w-full h-full object-cover" />
              {img.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/70 text-white text-[9px] text-center p-0.5">
                  {img.error}
                </div>
              )}
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showBranding && (
        <div className="px-1">
          <BrandingFields value={branding} onChange={setBranding} />
        </div>
      )}

      <div className="flex items-center justify-between px-1 pb-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={images.length >= MAX_IMAGES}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" /> Add photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addImages(e.target.files);
            e.target.value = "";
          }}
        />

        <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate{creditCost ? ` (${creditCost} credits)` : ""}
        </Button>
      </div>
    </div>
  );
}
