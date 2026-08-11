"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, Download, RotateCcw, CheckCircle2, Circle, Building2, Images, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useCreativeAdJob } from "./hooks/useCreativeAdJob";

// Single-stage creative-ad template - one form, one n8n round-trip via
// /api/creative-ads/generate, no multi-step wizard (unlike the video
// templates) since a static creative is one image, not a multi-scene build.
//
// Generic across every template in src/lib/creative-templates.js: the
// `template` prop supplies the copy (title, description, form placeholders),
// while the n8n workflow behind `template.templateKey` supplies the actual
// design being replicated. Adding template #4 needs no changes here.
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

function ChecklistItem({ done, children }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className={`flex items-center gap-2 text-sm ${done ? "text-emerald-600" : "text-neutral-400"}`}>
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </li>
  );
}

export default function CreativeAdGenerator({ template }) {
  const form = template.form || {};

  const [propertyName, setPropertyName] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheading, setSubheading] = useState("");
  const [ctaText, setCtaText] = useState(form.ctaDefault || "");
  const [tonality, setTonality] = useState("");
  const [location, setLocation] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [propertyImages, setPropertyImages] = useState([]);
  const [logo, setLogo] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);

  const propertyInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const job = useCreativeAdJob(template.templateKey);

  useEffect(() => {
    job.resumeIfInFlight();
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.templateKey]);

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
  const hasPropertyName = propertyName.trim().length > 0;
  const hasHeadline = headline.trim().length > 0;
  const hasPhotos = uploadedPropertyImages.length >= 1;
  const canGenerate = hasPropertyName && hasHeadline && hasPhotos && !hasUploadingImages && !hasFailedImages && job.phase !== "loading";

  const handleGenerate = () => {
    job.start({
      templateKey: template.templateKey,
      propertyName: propertyName.trim(),
      headline: headline.trim(),
      subheading: subheading.trim(),
      ctaText: ctaText.trim(),
      tonality: tonality.trim(),
      location: location.trim(),
      additionalDetails: additionalDetails.trim(),
      propertyImageUrls: uploadedPropertyImages.map((img) => img.r2Url),
      ...(logo?.r2Url ? { logoUrl: logo.r2Url } : {}),
    });
  };

  const handleReset = () => {
    setPropertyName("");
    setHeadline("");
    setSubheading("");
    setCtaText(form.ctaDefault || "");
    setTonality("");
    setLocation("");
    setAdditionalDetails("");
    setPropertyImages([]);
    setLogo(null);
    job.abort();
  };

  const handlePhotoDrop = (e) => {
    e.preventDefault();
    setIsDraggingPhotos(false);
    if (e.dataTransfer.files?.length) addPropertyImages(e.dataTransfer.files);
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
    <div className="max-w-6xl mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-medium">{template.title}</h1>
        {template.description && <p className="text-sm text-neutral-500 mt-1">{template.description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-neutral-400" /> Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="propertyName">Property Name</Label>
                  <Input
                    id="propertyName"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder={form.propertyNamePlaceholder}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="ctaText">Call to Action</Label>
                  <Input
                    id="ctaText"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder={form.ctaDefault}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={form.headlinePlaceholder}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="subheading">Subheading (optional)</Label>
                <Input
                  id="subheading"
                  value={subheading}
                  onChange={(e) => setSubheading(e.target.value)}
                  placeholder={form.subheadingPlaceholder}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {(form.showLocation || form.showAdditionalDetails) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-neutral-400" /> Location & Extras
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {form.showLocation && (
                  <div>
                    <Label htmlFor="location">Location (optional)</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={form.locationPlaceholder}
                      className="mt-1.5"
                    />
                  </div>
                )}
                {form.showAdditionalDetails && (
                  <div>
                    <Label htmlFor="additionalDetails">{form.additionalDetailsLabel || "Additional Details (optional)"}</Label>
                    <Textarea
                      id="additionalDetails"
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder={form.additionalDetailsPlaceholder}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="w-4 h-4 text-neutral-400" /> Style
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="tonality">Tonality (optional)</Label>
              <Textarea
                id="tonality"
                value={tonality}
                onChange={(e) => setTonality(e.target.value)}
                placeholder={form.tonalityPlaceholder}
                rows={2}
                className="mt-1.5"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Images className="w-4 h-4 text-neutral-400" /> Photos & Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Property Photos</Label>
                  <span className="text-xs text-neutral-400">{propertyImages.length}/{MAX_PROPERTY_IMAGES}</span>
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhotos(true);
                  }}
                  onDragLeave={() => setIsDraggingPhotos(false)}
                  onDrop={handlePhotoDrop}
                  className={`grid grid-cols-4 gap-3 mt-2 rounded-xl transition-colors ${
                    isDraggingPhotos ? "bg-primary/5 ring-2 ring-primary/40" : ""
                  }`}
                >
                  {propertyImages.map((img) => (
                    <ImageSlot key={img.id} image={img} onRemove={() => setPropertyImages((prev) => prev.filter((i) => i.id !== img.id))} />
                  ))}
                  {propertyImages.length < MAX_PROPERTY_IMAGES && (
                    <button
                      type="button"
                      onClick={() => propertyInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] leading-tight text-center px-1">Add or drop</span>
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
                      className="w-24 aspect-square rounded-xl border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
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
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <Card className="overflow-hidden py-0">
            <div className="relative aspect-3/4 bg-neutral-100">
              {template.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={template.image} alt={`${template.title} reference`} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            <CardContent className="py-4">
              <p className="text-xs text-neutral-500">
                Your creative follows this template&apos;s layout — the details you fill in replace the placeholder text and photos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                <ChecklistItem done={hasPropertyName}>Property name</ChecklistItem>
                <ChecklistItem done={hasHeadline}>Headline</ChecklistItem>
                <ChecklistItem done={hasPhotos}>At least 1 property photo</ChecklistItem>
              </ul>
              <Button size="lg" className="w-full" disabled={!canGenerate} onClick={handleGenerate}>
                {job.phase === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Generate Creative
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
