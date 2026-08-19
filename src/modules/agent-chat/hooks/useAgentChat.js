"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// The first token-by-token streaming consumer in this codebase - every
// other SSE-consuming hook (useModelTourVideoJob, useCreativeAdJob,
// useStudioJobs) only handles discrete named events, not incremental text.
// A message can carry a `toolCard` part ({tool, data}) alongside its text -
// the UI renders StoryboardCard/ChunkReviewGrid/FinalVideoCard by `tool`.
export function useAgentChat() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const startedRef = useRef(false);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/agent-chat/conversations", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
      setConversationId(data.conversationId);
    } catch (err) {
      setError(err.message || "Failed to start the assistant");
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  const sendMessage = useCallback(
    async ({ text, avatarImageUrls, propertyImageUrls, approvalFor }) => {
      if (!conversationId || sending || !text?.trim()) return;

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          text: text.trim(),
          avatarImageUrls: avatarImageUrls || [],
          propertyImageUrls: propertyImageUrls || [],
        },
        { id: assistantMsgId, role: "assistant", text: "", toolCard: null, pendingTool: null, streaming: true },
      ]);
      setSending(true);

      try {
        const res = await fetch(`/api/agent-chat/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), avatarImageUrls, propertyImageUrls, approvalFor }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Server error: ${res.status}`);
        }
        if (!res.body) throw new Error("No response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let reachedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const block of events) {
            for (const line of block.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "tool_started") {
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, pendingTool: event.tool } : m)));
                } else if (event.type === "tool_result") {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, toolCard: { tool: event.tool, data: event.data }, pendingTool: null } : m)),
                  );
                } else if (event.type === "text_delta") {
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + event.text } : m)));
                } else if (event.type === "done") {
                  reachedDone = true;
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false } : m)));
                } else if (event.type === "error") {
                  reachedDone = true;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false, error: event.message } : m)),
                  );
                  toast.error("Assistant hit an error", { description: event.message });
                }
              } catch (_) {}
            }
          }
        }

        if (!reachedDone) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, streaming: false, error: "Connection lost mid-reply." } : m,
            ),
          );
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, streaming: false, error: err.message || "Failed to send" } : m)),
        );
        toast.error("Failed to send message", { description: err.message });
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  // Convenience wrappers used by tool-result cards - the click itself is the
  // approval signal, so these just phrase it as a normal chat message.
  const approve = useCallback(
    (tool) => {
      const text =
        tool === "generate_video_scenes"
          ? "Looks good — please generate the scenes."
          : "Great, please combine them into the final video.";
      return sendMessage({ text, approvalFor: tool });
    },
    [sendMessage],
  );

  const regenerateScene = useCallback(
    (chunkIndex) => sendMessage({ text: `Please regenerate scene ${chunkIndex}.` }),
    [sendMessage],
  );

  return { messages, starting, sending, error, sendMessage, approve, regenerateScene };
}
