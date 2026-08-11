"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, User2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#c7f038]" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Replaces a scene's voiceover_audio_script by scene_chunk_id, leaving
// everything else in the script (headers/body/gender/cost/cinematic_direction,
// all of it) untouched - we only ever expose the voiceover line for editing.
function updateVoiceover(script, sceneId, value) {
  const storyboard = Array.isArray(script?.storyboard) ? script.storyboard : [];
  return {
    ...script,
    storyboard: storyboard.map((scene) =>
      scene.scene_chunk_id === sceneId ? { ...scene, voiceover_audio_script: value } : scene
    ),
  };
}

// Review step for the residential (n8n model-tour) flow. n8n's /model-tour/script
// call returns a big blob (webhook request echo + gender/cost/storyboard) - we
// only surface what the user should actually touch: one card per storyboard
// scene, editing just its voiceover line. Everything else in the script is
// carried through untouched and sent back as-is on Generate.
export function ModelTourFinalize({ images = [], selectedAvatars = [], script, onChange, onBack, onGenerate }) {
  const propertyPhotos = images.filter((img) => img.r2Url || img.url);
  const storyboard = Array.isArray(script?.storyboard) ? script.storyboard : [];

  // Local text state per scene so typing doesn't get clobbered by a
  // same-render onChange round-trip - committed to the parent's script on
  // every keystroke, but the textarea itself reads from this map. The cap
  // is the length of n8n's original voiceover line - fixed at that point
  // even if the user clears the field and retypes shorter/longer drafts.
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(storyboard.map((s) => [s.scene_chunk_id, s.voiceover_audio_script ?? ""]))
  );
  const [maxCharsBySceneId, setMaxCharsBySceneId] = useState(() =>
    Object.fromEntries(storyboard.map((s) => [s.scene_chunk_id, (s.voiceover_audio_script ?? "").length]))
  );
  // Every keystroke round-trips through the parent's onChange and comes back
  // down as a new `script` object - that's not a "new script arrived from
  // outside" event, it's an echo of our own edit, and must not re-derive
  // maxChars from the (possibly just-shortened) current text. lastEmitted
  // tracks what we ourselves last sent up, so the resync below only fires
  // for a genuinely external script (e.g. regenerating in the step before).
  const lastEmitted = useRef(script);
  const [syncedScript, setSyncedScript] = useState(script);
  if (script !== syncedScript && script !== lastEmitted.current) {
    setSyncedScript(script);
    setDrafts(Object.fromEntries(storyboard.map((s) => [s.scene_chunk_id, s.voiceover_audio_script ?? ""])));
    setMaxCharsBySceneId(
      Object.fromEntries(storyboard.map((s) => [s.scene_chunk_id, (s.voiceover_audio_script ?? "").length]))
    );
  } else if (script !== syncedScript) {
    setSyncedScript(script);
  }

  const handleVoiceoverChange = (sceneId, value, maxChars) => {
    const clamped = maxChars != null ? value.slice(0, maxChars) : value;
    setDrafts((prev) => ({ ...prev, [sceneId]: clamped }));
    const next = updateVoiceover(script, sceneId, clamped);
    lastEmitted.current = next;
    onChange?.(next);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Section icon={ImagePlus} title="Property Photos">
        {propertyPhotos.length === 0 ? (
          <p className="text-xs text-neutral-400">No photos uploaded.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {propertyPhotos.map((img, idx) => (
              <div key={img.id || idx} className="aspect-square rounded-lg overflow-hidden border border-border/40">
                <img src={img.r2Url || img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={User2} title="Presenter / Avatar">
        {selectedAvatars.length === 0 ? (
          <p className="text-xs text-neutral-400">No presenter selected.</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/40 shrink-0">
              <img src={selectedAvatars[0].url} alt={selectedAvatars[0].name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900">{selectedAvatars[0].name || "Custom presenter"}</p>
              <p className="text-xs text-neutral-500">
                {selectedAvatars.length} angle{selectedAvatars.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
        )}
      </Section>

      <Section icon={Clapperboard} title="Script">
        {storyboard.length === 0 ? (
          <p className="text-xs text-neutral-400">No script scenes returned.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {storyboard.map((scene) => {
              const maxChars = maxCharsBySceneId[scene.scene_chunk_id] ?? null;
              const length = (drafts[scene.scene_chunk_id] ?? "").length;
              const nearLimit = maxChars != null && length >= maxChars * 0.9;
              return (
                <div
                  key={scene.scene_chunk_id}
                  className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900">Scene {scene.scene_chunk_id}</span>
                    {scene.duration_seconds != null && (
                      <span className="text-[10px] text-neutral-400">{scene.duration_seconds}s</span>
                    )}
                  </div>
                  <Textarea
                    value={drafts[scene.scene_chunk_id] ?? ""}
                    onChange={(e) => handleVoiceoverChange(scene.scene_chunk_id, e.target.value, maxChars)}
                    maxLength={maxChars ?? undefined}
                    spellCheck={false}
                    className="text-xs min-h-28 resize-y bg-background flex-1"
                  />
                  {maxChars != null && (
                    <span className={`text-[10px] self-end ${nearLimit ? "text-amber-500" : "text-neutral-400"}`}>
                      {length} / {maxChars}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="cursor-pointer">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <Button
          onClick={onGenerate}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 shadow-lg gap-2 px-6"
        >
          Generate Video
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
