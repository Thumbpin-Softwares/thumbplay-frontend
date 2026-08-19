"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Renders the 6-scene storyboard the assistant proposed (propose_storyboard
// tool result) - scene_chunk_id/duration_seconds/voiceover_audio_script/
// cinematic_direction is the exact shape the n8n script-generation workflow
// returns, unwrapped by the backend's propose_storyboard tool handler.
export function StoryboardCard({ data, onApprove, approved, approving }) {
  const scenes = Array.isArray(data?.storyboard) ? data.storyboard : [];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-100">
        <p className="text-xs font-medium text-neutral-700">Proposed storyboard — {scenes.length} scenes</p>
      </div>
      <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
        {scenes.map((scene) => (
          <div key={scene.scene_chunk_id} className="px-3 py-2 flex gap-2">
            <span className="shrink-0 text-[10px] font-medium text-neutral-400 mt-0.5">
              {scene.scene_chunk_id}. {scene.duration_seconds}s
            </span>
            <p className="text-xs text-neutral-600 line-clamp-2">{scene.voiceover_audio_script}</p>
          </div>
        ))}
      </div>
      {!approved && (
        <div className="px-3 py-2 border-t border-neutral-100 flex justify-end">
          <Button size="sm" disabled={approving} onClick={onApprove}>
            <Sparkles className="w-3.5 h-3.5" /> Approve & Generate Scenes
          </Button>
        </div>
      )}
    </div>
  );
}
