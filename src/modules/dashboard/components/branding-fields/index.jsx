"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Sparkles } from "lucide-react";

// Per-generation branding (not account-level - the same account can make
// videos for many different properties/developers, each needing their own
// logo/name/contact) - a controlled optional form section any template's
// intake can drop in. `value` is { logoUrl, agencyName, contactInfo,
// primaryColor }, all optional; `onChange(next)` receives the merged patch.
// Backend fields it maps to: brandingLogoUrl/brandingAgencyName/
// brandingContactInfo/brandingPrimaryColor (see branding.service.ts).
export function BrandingFields({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const branding = value || {};

  const set = (patch) => onChange({ ...branding, ...patch });

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", "Brand logo");
      formData.append("type", "overlay");
      formData.append("category", "branding");

      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      set({ logoUrl: data.asset.url });
    } catch (err) {
      console.error("[BrandingFields] Logo upload failed:", err);
      toast.error("Logo upload failed", { description: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-border/50 p-3 space-y-3">
      <p className="text-xs font-medium text-neutral-700 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        Branding for this video (optional)
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-12 h-12 rounded-lg border border-dashed border-border flex items-center justify-center overflow-hidden shrink-0 hover:border-neutral-400 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <ImagePlus className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
        <Input
          value={branding.agencyName || ""}
          onChange={(e) => set({ agencyName: e.target.value })}
          placeholder="Agency / developer name"
          className="flex-1"
        />
      </div>

      <Input
        value={branding.contactInfo || ""}
        onChange={(e) => set({ contactInfo: e.target.value })}
        placeholder="Contact info - e.g. +91 98765 43210 · yourwebsite.com"
      />

      <div className="flex items-center gap-2">
        <Label htmlFor="brandingColor" className="text-xs text-muted-foreground shrink-0">
          Color
        </Label>
        <input
          id="brandingColor"
          type="color"
          value={branding.primaryColor || "#0a0a0a"}
          onChange={(e) => set({ primaryColor: e.target.value })}
          className="w-8 h-8 rounded-md border border-border cursor-pointer bg-transparent"
        />
      </div>
    </div>
  );
}
