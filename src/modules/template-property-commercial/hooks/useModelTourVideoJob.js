"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

// Background n8n video-generation job - split out of what used to be the
// full-screen ModelTourGeneration component so the runner can keep polling
// while the user is already on the Captions & Logo step picking styles.
// Same resume-on-refresh contract as before: a jobId in sessionStorage +
// GET /jobs/:jobId to reattach if the tab reloads mid-generation.
//
// `storageKey` defaults to the original model-tour (real estate) key -
// other templates sharing this hook (e.g. luxury-car-exit) must pass their
// own distinct key so an in-flight job in one template's tab doesn't get
// picked up as a resume target by another template's tab.
//
// Chunk review: the SSE stream now ends at "chunks_ready" instead of
// running through to "done" - the backend generates all 6 scene clips but
// waits for the user to review/regenerate before combining. From there this
// hook switches to plain polling (regenerateChunk/combine), since the
// review period is user-paced and unbounded, unsuitable for a held SSE
// connection.
export function useModelTourVideoJob(storageKey = "model-tour-job-id") {
  const JOB_ID_KEY = storageKey;
  const [phase, setPhase] = useState("idle"); // idle | loading | chunks_ready | error | done
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [chunks, setChunks] = useState([]);

  const scriptRef = useRef(null);
  const jobIdRef = useRef(null);
  const abortedRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Polls until the job reaches a terminal (done/error) or chunks_ready
  // state - shared by refresh-resume and by combine()'s post-Export wait.
  const pollUntilSettled = (jobId) => {
    const poll = async () => {
      if (abortedRef.current) return;
      try {
        const res = await fetch(`/api/model-tour/jobs/${jobId}`);
        if (abortedRef.current) return;
        if (res.status === 404) {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          start(scriptRef.current);
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        // A crashed/unreachable backend can surface here as an HTML error
        // page rather than JSON - parse defensively instead of letting a
        // raw SyntaxError ("Unexpected token '<'...") reach the UI.
        const { job } = await res.json().catch(() => ({ job: null }));
        if (!job) throw new Error("Resume failed: invalid job response");
        if (job.status === "done") {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          setResultUrl(job.resultUrl);
          setPhase("done");
          return;
        }
        if (job.status === "error") {
          try {
            sessionStorage.removeItem(JOB_ID_KEY);
          } catch (_) {}
          setPhase("error");
          setError(job.error || "Generation failed");
          return;
        }
        if (job.status === "chunks_ready") {
          setChunks(job.chunks || []);
          setPhase("chunks_ready");
          return;
        }
        // running or combining - keep polling
        if (!abortedRef.current) setTimeout(poll, 3000);
      } catch (err) {
        console.error("[ModelTour] Resume poll failed:", err);
        if (!abortedRef.current) setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const start = async (script) => {
    scriptRef.current = script;
    abortedRef.current = false;
    setPhase("loading");
    setError(null);
    setResultUrl(null);
    setChunks([]);

    const jobId = crypto.randomUUID();
    jobIdRef.current = jobId;
    try {
      sessionStorage.setItem(JOB_ID_KEY, jobId);
    } catch (_) {}

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let reachedTerminal = false;

    try {
      const res = await fetch("/api/model-tour/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, script }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (abortedRef.current) break;
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
              if (event.type === "chunks_ready") {
                reachedTerminal = true;
                setChunks(event.chunks || []);
                setPhase("chunks_ready");
                toast.success("All 6 scenes are ready to review!");
              } else if (event.type === "done") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(JOB_ID_KEY);
                } catch (_) {}
                setResultUrl(event.resultUrl);
                setPhase("done");
                toast.success("Home tour video ready!");
              } else if (event.type === "error") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(JOB_ID_KEY);
                } catch (_) {}
                setPhase("error");
                setError(event.message || "Generation failed");
              }
            } catch (_) {}
          }
        }
      }

      if (!abortedRef.current && !reachedTerminal) {
        const message = "Lost connection to the server mid-generation. Refresh this page - it'll try to resume the job in progress.";
        setPhase("error");
        setError(message);
        toast.error("Connection lost", { description: message });
      }
    } catch (err) {
      if (err.name === "AbortError" || abortedRef.current) return;
      console.error("[ModelTour] Generation error:", err);
      try {
        sessionStorage.removeItem(JOB_ID_KEY);
      } catch (_) {}
      setPhase("error");
      setError(err.message || "Generation failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const retry = () => start(scriptRef.current);

  const abort = () => {
    abortedRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    try {
      sessionStorage.removeItem(JOB_ID_KEY);
    } catch (_) {}
    setPhase("idle");
  };

  // Regenerates one chunk (1-based index). Optimistically flips that tile to
  // "regenerating" locally, then polls the job doc until it leaves that
  // state - other tiles are untouched throughout.
  const regenerateChunk = async (index, note) => {
    const jobId = jobIdRef.current;
    if (!jobId) return;

    setChunks((prev) => prev.map((c) => (c.index === index ? { ...c, status: "regenerating" } : c)));

    try {
      const res = await fetch(`/api/model-tour/jobs/${jobId}/chunks/${index}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
    } catch (err) {
      setChunks((prev) => prev.map((c) => (c.index === index ? { ...c, status: "error" } : c)));
      toast.error(`Failed to regenerate scene ${index}`, { description: err.message });
      return;
    }

    const pollChunk = async () => {
      if (abortedRef.current) return;
      try {
        const res = await fetch(`/api/model-tour/jobs/${jobId}`);
        const { job } = await res.json().catch(() => ({ job: null }));
        const chunk = job?.chunks?.find((c) => c.index === index);
        if (!chunk || chunk.status === "regenerating") {
          if (!abortedRef.current) setTimeout(pollChunk, 4000);
          return;
        }
        setChunks(job.chunks || []);
        if (chunk.status === "error") {
          toast.error(`Scene ${index} regeneration failed`);
        }
      } catch (err) {
        console.error("[ModelTour] Chunk regen poll failed:", err);
        if (!abortedRef.current) setTimeout(pollChunk, 5000);
      }
    };
    pollChunk();
  };

  // Combines the current set of chunks (originals + any regenerated) and
  // hands off to the splitter/voice-change workflow - same "done" terminal
  // state as the pre-chunk-review flow.
  const combine = async () => {
    const jobId = jobIdRef.current;
    if (!jobId) return;

    setPhase("loading");
    try {
      const res = await fetch(`/api/model-tour/jobs/${jobId}/combine`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
    } catch (err) {
      setPhase("chunks_ready");
      toast.error("Failed to start combining", { description: err.message });
      return;
    }

    pollUntilSettled(jobId);
  };

  // Called once on mount by the runner - resumes an in-flight job if the tab
  // was refreshed mid-generation, otherwise leaves phase at "idle". `script`
  // is only needed so a post-resume Retry (after an error) has something to
  // resend - the runner restores it from its own sessionStorage snapshot.
  const resumeIfInFlight = (script) => {
    let existingJobId = null;
    try {
      existingJobId = sessionStorage.getItem(JOB_ID_KEY);
    } catch (_) {}
    if (!existingJobId) return false;
    scriptRef.current = script;
    jobIdRef.current = existingJobId;
    setPhase("loading");
    pollUntilSettled(existingJobId);
    return true;
  };

  return { phase, error, resultUrl, chunks, start, retry, abort, resumeIfInFlight, regenerateChunk, combine };
}
