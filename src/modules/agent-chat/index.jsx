"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useAgentChat } from "./hooks/useAgentChat";
import { ChatComposer } from "./components/ChatComposer";
import { StoryboardCard } from "./components/StoryboardCard";
import { FinalVideoCard } from "./components/FinalVideoCard";
import { ChunkReviewGrid } from "@/modules/template-property-commercial/components/ChunkReviewGrid";

const PENDING_TOOL_LABELS = {
  propose_storyboard: "Putting together a storyboard…",
  generate_video_scenes: "Generating all 6 scenes — this can take a few minutes…",
  regenerate_scene: "Regenerating that scene…",
  combine_video: "Combining the final video…",
};

function ToolCard({ toolCard, hasGeneratedScenes, hasCombined, onApprove, onRegenerateScene }) {
  if (!toolCard) return null;

  if (toolCard.tool === "propose_storyboard") {
    return <StoryboardCard data={toolCard.data} approved={hasGeneratedScenes} onApprove={() => onApprove("generate_video_scenes")} />;
  }

  if (toolCard.tool === "generate_video_scenes" || toolCard.tool === "regenerate_scene") {
    if (hasCombined) return null;
    return (
      <ChunkReviewGrid chunks={toolCard.data?.chunks || []} onRegenerate={onRegenerateScene} onCombine={() => onApprove("combine_video")} />
    );
  }

  if (toolCard.tool === "combine_video") {
    return <FinalVideoCard data={toolCard.data} />;
  }

  return null;
}

// Bubble layout/styling bootstrapped from dashboard/components/support-chat,
// rewritten to consume useAgentChat's token-streaming events and to embed
// structured tool-result cards (storyboard, scene review, final video) under
// the relevant assistant bubble instead of only plain text.
export default function AgentChat() {
  const { messages, starting, sending, error, sendMessage, approve, regenerateScene } = useAgentChat();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Simplification: once any message shows scenes generated, hide the
  // storyboard's Approve button everywhere; once combined, hide the scene
  // grid's Export button everywhere. Doesn't prevent a stray re-click from
  // re-sending the request (harmless - the tool just re-runs against the
  // latest job state) - not worth more state machinery for a first version.
  const hasGeneratedScenes = useMemo(
    () => messages.some((m) => m.toolCard?.tool === "generate_video_scenes" || m.toolCard?.tool === "regenerate_scene"),
    [messages],
  );
  const hasCombined = useMemo(() => messages.some((m) => m.toolCard?.tool === "combine_video"), [messages]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-medium">Ad Assistant</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Describe your property and attach a few photos — the assistant proposes a storyboard, generates the scenes, and combines them
          into a final video, right here in chat.
        </p>
      </div>

      <div className="flex h-[65vh] flex-col overflow-hidden rounded-[32px] border border-[#c7f038]/20 bg-white/85 shadow-[0_20px_60px_rgba(199,240,56,0.12)] backdrop-blur-xl">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-[#f8fce8]/40 to-white p-6">
          {starting ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-1">
              <p className="text-sm font-medium text-muted-foreground">Tell me about the property you want to advertise 👋</p>
              <p className="text-xs text-muted-foreground/70">Attach a presenter photo and a few property photos to get started.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[#111111] text-[#c7f038] rounded-br-sm shadow-lg"
                      : "bg-white border border-neutral-100 text-neutral-900 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {m.text ? (
                    <p className="whitespace-pre-wrap wrap-break-words">{m.text}</p>
                  ) : m.pendingTool ? (
                    <p className="flex items-center gap-2 text-neutral-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {PENDING_TOOL_LABELS[m.pendingTool] || "Working on it…"}
                    </p>
                  ) : m.streaming ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                  ) : null}
                  {m.error && <p className="mt-1 text-xs text-destructive">{m.error}</p>}
                </div>
                {m.toolCard && (
                  <div className="max-w-[85%] w-full">
                    <ToolCard
                      toolCard={m.toolCard}
                      hasGeneratedScenes={hasGeneratedScenes}
                      hasCombined={hasCombined}
                      onApprove={approve}
                      onRegenerateScene={regenerateScene}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <ChatComposer onSend={sendMessage} disabled={starting || sending || !!error} />
      </div>
    </div>
  );
}
