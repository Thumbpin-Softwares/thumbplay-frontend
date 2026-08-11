"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

// Mirrors template-property-commercial's useModelTourVideoJob, but for a
// single-round-trip creative-ad generation: the backend generates its own
// jobId (sent back as a "started" SSE event) rather than the client minting
// one up front, since there's no separate script/edit checkpoint here.
//
// Namespaced by templateKey so an in-flight job on one template's page
// doesn't get mistakenly resumed on another template's page.
export function useCreativeAdJob(templateKey) {
  const jobIdKey = `creative-ad-job-id:${templateKey}`;

  const [phase, setPhase] = useState("idle"); // idle | loading | error | done
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);

  const inputRef = useRef(null);
  const abortedRef = useRef(false);
  const abortControllerRef = useRef(null);

  const resumeJob = (jobId) => {
    const poll = async () => {
      if (abortedRef.current) return;
      try {
        const res = await fetch(`/api/creative-ads/jobs/${jobId}`);
        if (abortedRef.current) return;
        if (res.status === 404) {
          try {
            sessionStorage.removeItem(jobIdKey);
          } catch (_) {}
          setPhase("idle");
          return;
        }
        if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

        const { job } = await res.json().catch(() => ({ job: null }));
        if (!job) throw new Error("Resume failed: invalid job response");
        if (job.status === "done") {
          try {
            sessionStorage.removeItem(jobIdKey);
          } catch (_) {}
          setResultUrl(job.resultUrl);
          setPhase("done");
          return;
        }
        if (job.status === "error") {
          try {
            sessionStorage.removeItem(jobIdKey);
          } catch (_) {}
          setPhase("error");
          setError(job.error || "Generation failed");
          return;
        }
        if (!abortedRef.current) setTimeout(poll, 3000);
      } catch (err) {
        console.error("[CreativeAds] Resume poll failed:", err);
        if (!abortedRef.current) setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const start = async (input) => {
    inputRef.current = input;
    abortedRef.current = false;
    setPhase("loading");
    setError(null);
    setResultUrl(null);
    setMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let reachedTerminal = false;

    try {
      const res = await fetch("/api/creative-ads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
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
              if (event.type === "started" && event.jobId) {
                try {
                  sessionStorage.setItem(jobIdKey, event.jobId);
                } catch (_) {}
              } else if (event.type === "generating" || event.type === "processing") {
                setMessage(event.message || null);
              } else if (event.type === "done") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(jobIdKey);
                } catch (_) {}
                setResultUrl(event.resultUrl);
                setPhase("done");
                toast.success("Creative ready!");
              } else if (event.type === "error") {
                reachedTerminal = true;
                try {
                  sessionStorage.removeItem(jobIdKey);
                } catch (_) {}
                setPhase("error");
                setError(event.message || "Generation failed");
              }
            } catch (_) {}
          }
        }
      }

      if (!abortedRef.current && !reachedTerminal) {
        const msg = "Lost connection to the server mid-generation. Refresh this page — it'll try to resume the job in progress.";
        setPhase("error");
        setError(msg);
        toast.error("Connection lost", { description: msg });
      }
    } catch (err) {
      if (err.name === "AbortError" || abortedRef.current) return;
      console.error("[CreativeAds] Generation error:", err);
      try {
        sessionStorage.removeItem(jobIdKey);
      } catch (_) {}
      setPhase("error");
      setError(err.message || "Generation failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const retry = () => start(inputRef.current);

  const abort = () => {
    abortedRef.current = true;
    try {
      abortControllerRef.current?.abort();
    } catch (_) {}
    try {
      sessionStorage.removeItem(jobIdKey);
    } catch (_) {}
    setPhase("idle");
  };

  // Called once on mount by the runner — resumes an in-flight job if the tab
  // was refreshed mid-generation.
  const resumeIfInFlight = () => {
    let existingJobId = null;
    try {
      existingJobId = sessionStorage.getItem(jobIdKey);
    } catch (_) {}
    if (!existingJobId) return false;
    setPhase("loading");
    resumeJob(existingJobId);
    return true;
  };

  return { phase, message, error, resultUrl, start, retry, abort, resumeIfInFlight };
}
