"use client";

import { useEffect } from "react";
import { ChevronDown, FileText, Wand2, Building2, Home, Trees, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// All three route through the n8n model-tour pipeline now (it switches its
// master prompt internally based on `type`). "Land" is shown to the user in
// place of "Plotted" — the value sent as `type` is still "plotted", n8n's
// switch doesn't change.
const CLASSIFICATIONS = [
  { id: "commercial", label: "Commercial", description: "Offices, malls, business centers", icon: Building2 },
  { id: "residential", label: "Residential", description: "Apartments, villas, housing projects", icon: Home },
  { id: "plotted", label: "Land", description: "Plots, farmhouses, agricultural land", icon: Trees },
];

const SCRIPT_MODES = [
  { id: "ai", label: "Generate with AI", description: "Answer a few questions and we'll write it for you", icon: Wand2 },
  { id: "manual", label: "Manual Script", description: "Write or paste your own script", icon: FileText },
];

const GLOBAL_REQUIRED = ["propertyClassification", "scriptMode", "projectName", "projectType", "projectArea", "location", "tonality", "landmarks", "connectivity", "vibe", "language"];

// Checks the fields required for the current classification. Tonality,
// Landmarks, Connectivity, Vibe, and Language are global (every property
// type needs them, not just Residential). Plotted only requires Carpet Area
// beyond the global set; Commercial additionally requires Shop Type + Shop
// Built-up Area; Residential also requires Carpet Area + Amenities.
export function isSiteFormValid(values = {}) {
  const filled = (key) => !!values[key]?.toString().trim();

  if (values.scriptMode === "manual") {
    return (
      filled("propertyClassification") &&
      filled("projectName") &&
      filled("projectType") &&
      filled("language") &&
      filled("manualScript")
    );
  }

  if (!GLOBAL_REQUIRED.every(filled)) return false;

  if (values.propertyClassification === "commercial") {
    return filled("shopType") && filled("shopBuiltUpArea");
  }
  if (values.propertyClassification === "residential") {
    return filled("carpetArea") && filled("amenities");
  }
  if (values.propertyClassification === "plotted") {
    return filled("carpetArea");
  }
  return false;
}

const TONALITY_OPTIONS = [
  "Aspirational",
  "Premium",
  "Warm & Inviting",
  "Luxurious",
  "Energetic",
  "Sophisticated",
  "Friendly",
  "Elegant",
  "Modern",
  "Trustworthy",
];

const PROJECT_TYPES = [
  { id: "affordable", label: "Affordable" },
  { id: "luxury", label: "Luxury" },
  { id: "ultra-luxury", label: "Ultra Luxury" },
];

// Commercial doesn't fit the residential Affordable/Luxury/Ultra Luxury
// tiering — it's categorized by the kind of space instead.
const COMMERCIAL_PROJECT_TYPES = [
  { id: "it-parks-corporate-towers", label: "IT Parks & Corporate Towers" },
  { id: "co-working-spaces", label: "Co-working Spaces" },
  { id: "business-centers", label: "Business Centers" },
  { id: "high-street-outlets", label: "High-Street Outlets" },
  { id: "shopping-malls", label: "Shopping Malls" },
  { id: "hospitality-spaces", label: "Hospitality Spaces" },
];

// Land ("plotted") is categorized by land use, not price tier or space kind.
const LAND_PROJECT_TYPES = [
  { id: "plots", label: "Plots" },
  { id: "farmhouse", label: "Farmhouse" },
  { id: "agricultural-land", label: "Agricultural Land" },
  { id: "industrial-plots", label: "Industrial Plots" },
];

// Script/voice language for the model-tour n8n pipeline — passed through as
// a raw string, not used locally to pick a TTS voice (unlike the reel/
// car-exit pipelines' Sarvam-backed language list in utils/constants.js).
const LANGUAGES = [
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
  { id: "assamese", label: "Assamese" },
  { id: "bengali", label: "Bengali" },
  { id: "gujarati", label: "Gujarati" },
  { id: "kannada", label: "Kannada" },
  { id: "odia", label: "Odia" },
  { id: "punjabi", label: "Punjabi" },
];

const VIBE_OPTIONS = [
  "Calm",
  "Energetic",
  "Cinematic",
  "Warm",
  "Bold",
  "Minimal",
  "Playful",
  "Elegant",
  "Dramatic",
  "Serene",
  "Vibrant",
  "Sophisticated",
];

function FieldLabel({ children, required }) {
  return (
    <Label className="text-xs text-neutral-700">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-neutral-400 ml-1">(Optional)</span>}
    </Label>
  );
}

function TextField({ label, field, values, setField, required, placeholder, hint, textarea }) {
  const Comp = textarea ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <Comp
        value={values[field] || ""}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className={textarea ? "min-h-20 resize-none text-sm" : "text-sm"}
      />
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// Bordered selectable card — shared visual for the Property Classification
// and Script mode pickers, modeled on the avatar-selection card pattern in
// ModelSelector (border highlight + check badge when selected).
function OptionCard({ icon: Icon, label, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
        selected ? "border-[#c7f038] ring-2 ring-[#c7f038] bg-neutral-900" : "border-border/40 hover:border-[#c7f038] bg-card/50"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#c7f038]">
          <Check className="w-3 h-3 text-black" />
        </div>
      )}
      <div className="flex gap-4 items-center justify-center">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-[#c7f038]" : "bg-neutral-100"}`}>
        <Icon className={`w-4.5 h-4.5 ${selected ? "text-black" : "text-neutral-700"}`} />
      </div>
      <div>
        <p className={`text-sm font-semibold ${selected ? "text-[#c7f038]" : "text-neutral-800"}`}>{label}</p>
        <p className={`text-[11px] ${selected ? "text-neutral-300" : "text-neutral-400"}`}>{description}</p>
      </div>
      </div>
    </button>
  );
}

// Allows picking several descriptors at once — stored as the same kind of
// comma-joined string a free-text field would produce, so downstream
// consumers (modelTourScriptRequest, isSiteFormValid) don't need to know
// it's backed by a multi-select. Shared by Tonality and Vibe.
function MultiSelectField({ label, field, options, values, setField, required, placeholder, hint }) {
  const selected = (values[field] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    setField(field, next.join(", "));
  };

  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm text-left"
          >
            <span className={selected.length ? "" : "text-muted-foreground"}>
              {selected.length ? selected.join(", ") : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt}
              checked={selected.includes(opt)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(opt)}
            >
              {opt}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// Shared "Script" step form — collects the details used to generate the
// script/voice for a template's pipeline. Shared across all templates;
// which fields render depends on Property Classification, but the form
// shell itself is the same everywhere.
//
// Controlled via `values` + `onChange(nextValues)` so a field can be added
// with `setField("key", val)` without each template managing its own
// individual useState per field.
export function SiteForm({ values = {}, onChange }) {
  const setField = (key, val) => onChange?.({ ...values, [key]: val });
  const classification = values.propertyClassification;
  const scriptMode = values.scriptMode;
  const projectTypeOptions =
    classification === "commercial"
      ? COMMERCIAL_PROJECT_TYPES
      : classification === "plotted"
        ? LAND_PROJECT_TYPES
        : PROJECT_TYPES;

  // Stored as the option's label (not its id) — sent to n8n as `tier_class`,
  // and a plain label like "Shopping Malls" is far easier for the LLM
  // prompt to read than a slug like "shopping-malls". Affordable/Luxury/
  // Ultra Luxury and the Commercial space types are disjoint sets, so a
  // project type picked before switching classification would otherwise
  // linger as a stale, mismatched value.
  useEffect(() => {
    if (values.projectType && !projectTypeOptions.some((t) => t.label === values.projectType)) {
      setField("projectType", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classification]);

  return (
    <div className="space-y-5">
      {/* ── Step 1: Property Classification ── */}
      <div className="space-y-1.5">
        <FieldLabel required>Select your property classification</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CLASSIFICATIONS.map((c) => (
            <OptionCard
              key={c.id}
              icon={c.icon}
              label={c.label}
              description={c.description}
              selected={classification === c.id}
              onClick={() => setField("propertyClassification", c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Step 2: Script mode ── */}
      {classification && (
        <div className="space-y-1.5">
          <FieldLabel required>How would you like to add the script?</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SCRIPT_MODES.map((m) => (
              <OptionCard
                key={m.id}
                icon={m.icon}
                label={m.label}
                description={m.description}
                selected={scriptMode === m.id}
                onClick={() => setField("scriptMode", m.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: The form, revealed once a script mode is chosen ── */}
      {classification && scriptMode && (
      <div className="space-y-4">
        <TextField label="Project Name" field="projectName" values={values} setField={setField} required />

        {scriptMode === "manual" && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <FieldLabel required>Project Type</FieldLabel>
                <Select value={values.projectType || ""} onValueChange={(v) => setField("projectType", v)}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypeOptions.map((t) => (
                      <SelectItem key={t.id} value={t.label}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <FieldLabel required>Language</FieldLabel>
                <Select value={values.language || ""} onValueChange={(v) => setField("language", v)}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TextField
              label="Property Script"
              field="manualScript"
              values={values}
              setField={setField}
              required
              textarea
              placeholder="Write or paste the full script for this property..."
            />
          </div>
        )}

        {scriptMode === "ai" && (
        <>
        <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel required>Project Type</FieldLabel>
            <Select value={values.projectType || ""} onValueChange={(v) => setField("projectType", v)}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {projectTypeOptions.map((t) => (
                  <SelectItem key={t.id} value={t.label}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TextField
            label="Project Area"
            field="projectArea"
            values={values}
            setField={setField}
            required
            placeholder="e.g., 5 acres, 2.5M sqft township"
            hint="Total built-up area, township area, or project area"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-4">
            <TextField label="Location" field="location" values={values} setField={setField} required />
            <div className="space-y-1.5">
              <FieldLabel required>Language</FieldLabel>
              <Select value={values.language || ""} onValueChange={(v) => setField("language", v)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            <TextField label="Landmarks" field="landmarks" values={values} setField={setField} required />
            <TextField label="Connectivity" field="connectivity" values={values} setField={setField} required />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <MultiSelectField
            label="Tonality"
            field="tonality"
            options={TONALITY_OPTIONS}
            values={values}
            setField={setField}
            required
            placeholder="Select tonality"
            hint="Guides the tone for the generated script"
          />

          <MultiSelectField
            label="Vibe"
            field="vibe"
            options={VIBE_OPTIONS}
            values={values}
            setField={setField}
            required
            placeholder="Select vibe"
            hint="Guides the video's visual mood"
          />
        </div>
      </div>

      {/* ── Commercial ── */}
      {classification === "commercial" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Commercial Details</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Shop Type" field="shopType" values={values} setField={setField} required />
            <TextField label="Shop Built-up Area" field="shopBuiltUpArea" values={values} setField={setField} required />
            <TextField label="Footfall" field="footfall" values={values} setField={setField} />
            <TextField label="Brand Relationships" field="brandRelationships" values={values} setField={setField} />
          </div>
          <TextField label="Revenue Potential" field="revenuePotential" values={values} setField={setField} textarea />
        </div>
      )}

      {/* ── Residential ── */}
      {classification === "residential" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Residential Details</p>
          <TextField
            label="Carpet Area"
            field="carpetArea"
            values={values}
            setField={setField}
            required
            placeholder="e.g., 1200 sqft, 3600 sqft"
          />
          <TextField label="Amenities" field="amenities" values={values} setField={setField} required textarea />
        </div>
      )}

      {/* ── Plotted ── */}
      {classification === "plotted" && (
        <div className="space-y-4 rounded-xl border border-border/50 p-4 bg-card/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Plotted Details</p>
          <TextField label="Carpet Area" field="carpetArea" values={values} setField={setField} required />

          <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-neutral-700">Gated Community</p>
              <p className="text-[11px] text-neutral-400">Optional</p>
            </div>
            <Switch
              checked={!!values.gatedCommunity}
              onCheckedChange={(v) => setField("gatedCommunity", v)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Water Supply and Area Type" field="waterSupplyAreaType" values={values} setField={setField} />
            <TextField label="Nearby Settlements" field="nearbySettlements" values={values} setField={setField} />
          </div>
          <TextField label="Amenities" field="amenities" values={values} setField={setField} textarea />
        </div>
      )}
        </>
        )}
      </div>
      )}
    </div>
  );
}
