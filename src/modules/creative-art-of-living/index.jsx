"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreativeAdJob } from "./hooks/useCreativeAdJob";

// Single-stage creative-ad template — one form, one n8n round-trip via
// /api/creative-ads/generate, no multi-step wizard (unlike the video
// templates) since a static creative is one image, not a multi-scene build.
const TEMPLATE_KEY = "art-of-living";
const MAX_PROPERTY_IMAGES = 4;

// Property photos + logo both land in the shared Asset library through the
// same endpoint every other template already posts property photos to.
async function uploadImage(file, name) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  const res = await fetch("/api/model-tour/upload/property", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.asset?.url) throw new Error(data.error || "Upload failed");
  return data.asset.url;
}

function ImageSlot({ image, onRemove }) {
  return (
    <div className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
      {image.previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.previewUrl} alt={image.name} className="absolute inset-0 w-full h-full object-cover" />
      )}
      {image.uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
      )}
      {image.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/70 text-white text-xs text-center p-2">
          {image.error}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ArtOfLivingCreative() {
  const [propertyName, setPropertyName] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheading, setSubheading] = useState("");
  const [ctaText, setCtaText] = useState("Book a Visit");
  const [tonality, setTonality] = useState("");
  const [propertyImages, setPropertyImages] = useState([]);
  const [logo, setLogo] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const propertyInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const job = useCreativeAdJob();

  useEffect(() => {
    job.resumeIfInFlight();
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addPropertyImages = async (files) => {
    const remaining = MAX_PROPERTY_IMAGES - propertyImages.length;
    const toAdd = Array.from(files).slice(0, Math.max(0, remaining));
    for (const file of toAdd) {
      const previewUrl = URL.createObjectURL(file);
      const entry = { id: crypto.randomUUID(), previewUrl, name: file.name, uploading: true, r2Url: null, error: null };
      setPropertyImages((prev) => [...prev, entry]);
      try {
        const url = await uploadImage(file, "Property Photo");
        setPropertyImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, uploading: false, r2Url: url } : img)));
      } catch (err) {
        setPropertyImages((prev) => prev.map((img) => (img.id === entry.id ? { ...img, uploading: false, error: err.message } : img)));
      }
    }
  };

  const addLogo = async (files) => {
    const file = files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setLogo({ previewUrl, name: file.name, uploading: true, r2Url: null, error: null });
    try {
      const url = await uploadImage(file, "Brand Logo");
      setLogo((prev) => (prev ? { ...prev, uploading: false, r2Url: url } : prev));
    } catch (err) {
      setLogo((prev) => (prev ? { ...prev, uploading: false, error: err.message } : prev));
    }
  };

  const uploadedPropertyImages = propertyImages.filter((img) => img.r2Url);
  const hasUploadingImages = propertyImages.some((img) => img.uploading) || logo?.uploading;
  const hasFailedImages = propertyImages.some((img) => img.error) || logo?.error;
  const canGenerate =
    propertyName.trim().length > 0 &&
    headline.trim().length > 0 &&
    uploadedPropertyImages.length >= 1 &&
    !hasUploadingImages &&
    !hasFailedImages &&
    job.phase !== "loading";

  const handleGenerate = () => {
    job.start({
      templateKey: TEMPLATE_KEY,
      propertyName: propertyName.trim(),
      headline: headline.trim(),
      subheading: subheading.trim(),
      ctaText: ctaText.trim() || "Learn More",
      tonality: tonality.trim(),
      propertyImageUrls: uploadedPropertyImages.map((img) => img.r2Url),
      ...(logo?.r2Url ? { logoUrl: logo.r2Url } : {}),
    });
  };

  const handleReset = () => {
    setPropertyName("");
    setHeadline("");
    setSubheading("");
    setCtaText("Book a Visit");
    setTonality("");
    setPropertyImages([]);
    setLogo(null);
    job.abort();
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (job.phase === "loading" || job.phase === "done" || job.phase === "error") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-6 animate-fade-in">
        {job.phase === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div>
              <h2 className="text-xl font-medium">Generating your creative…</h2>
              <p className="text-sm text-neutral-500 mt-1">{job.message || "This usually takes under a minute."}</p>
            </div>
          </>
        )}

        {job.phase === "done" && job.resultUrl && (
          <>
            <div className="relative w-full max-w-sm aspect-2/3 rounded-2xl overflow-hidden border border-neutral-200 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.resultUrl} alt="Generated creative" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <a href={job.resultUrl} download target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-1.5" /> Download
                </a>
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Generate Another
              </Button>
            </div>
          </>
        )}

        {job.phase === "error" && (
          <>
            <div>
              <h2 className="text-xl font-medium text-red-600">Generation failed</h2>
              <p className="text-sm text-neutral-500 mt-1">{job.error}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={job.retry}>Retry</Button>
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-medium">Art of Living</h1>
        <p className="text-sm text-neutral-500 mt-1">A premium editorial-style static ad for your property.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="propertyName">Property Name</Label>
          <Input id="propertyName" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Skyline Residences" />
        </div>
        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Where Luxury Meets Living" />
        </div>
        <div>
          <Label htmlFor="subheading">Subheading (optional)</Label>
          <Input
            id="subheading"
            value={subheading}
            onChange={(e) => setSubheading(e.target.value)}
            placeholder="3 & 4 BHK Residences in the Heart of the City"
          />
        </div>
        <div>
          <Label htmlFor="ctaText">Call to Action</Label>
          <Input id="ctaText" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Book a Visit" />
        </div>
        <div>
          <Label htmlFor="tonality">Tonality (optional)</Label>
          <Textarea
            id="tonality"
            value={tonality}
            onChange={(e) => setTonality(e.target.value)}
            placeholder="warm, aspirational, editorial"
            rows={2}
          />
        </div>
      </div>

      <div>
        <Label>Property Photos (1–4)</Label>
        <div className="grid grid-cols-4 gap-3 mt-2">
          {propertyImages.map((img) => (
            <ImageSlot key={img.id} image={img} onRemove={() => setPropertyImages((prev) => prev.filter((i) => i.id !== img.id))} />
          ))}
          {propertyImages.length < MAX_PROPERTY_IMAGES && (
            <button
              type="button"
              onClick={() => propertyInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
            >
              <Upload className="w-5 h-5" />
            </button>
          )}
        </div>
        <input
          ref={propertyInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addPropertyImages(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <Label>Brand Logo (optional)</Label>
        <div className="mt-2">
          {logo ? (
            <div className="w-24">
              <ImageSlot image={logo} onRemove={() => setLogo(null)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="w-24 aspect-square rounded-xl border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
            >
              <Upload className="w-5 h-5" />
            </button>
          )}
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addLogo(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <Button size="lg" disabled={!canGenerate} onClick={handleGenerate}>
        Generate Creative
      </Button>
    </div>
  );
}
