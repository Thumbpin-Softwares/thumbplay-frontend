"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

// Background n8n video-generation job — split out of what used to be the
// full-screen ModelTourGeneration component so the runner can keep polling
// while the user is already on the Captions & Logo step picking styles.
// Same resume-on-refresh contract as before: a jobId in sessionStorage +
// GET /jobs/:jobId to reattach if the tab reloads mid-generation.
//
// `storageKey` defaults to the original model-tour (real estate) key —
// other templates sharing this hook (e.g. luxury-car-exit) must pass their
// own distinct key so an in-flight job in one template's tab doesn't get
// picked up as a resume target by another template's tab.
export function useModelTourVideoJob(storageKey = "model-tour-job-id") {
  const JOB_ID_KEY = storageKey;
  const [phase, setPhase] = useState("idle"); // idle | loading | error | done
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  const scriptRef = useRef(null);
  const abortedRef = useRef(false);
  const abortControllerRef = useRef(null);

  const resumeJob = (jobId) => {
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
        // page rather than JSON — parse defensively instead of letting a
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

    const jobId = crypto.randomUUID();
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
              if (event.type === "done") {
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
        const message = "Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.";
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

  // Called once on mount by the runner — resumes an in-flight job if the tab
  // was refreshed mid-generation, otherwise leaves phase at "idle". `script`
  // is only needed so a post-resume Retry (after an error) has something to
  // resend — the runner restores it from its own sessionStorage snapshot.
  const resumeIfInFlight = (script) => {
    let existingJobId = null;
    try {
      existingJobId = sessionStorage.getItem(JOB_ID_KEY);
    } catch (_) {}
    if (!existingJobId) return false;
    scriptRef.current = script;
    setPhase("loading");
    resumeJob(existingJobId);
    return true;
  };

  return { phase, error, resultUrl, start, retry, abort, resumeIfInFlight };
}
