"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Deliberately not SSE/resume-on-refresh like useCreativeAdJob/useModelTourVideoJob
// - Studio jobs run detached from the request that created them (see
// studio.controller.ts), so there's nothing to "resume": we just poll the
// generations list, and only while something in it is still running.
export function useStudioJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/generations");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load your generations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load from a server-owned resource - same one-time-sync
    // justification as Aside's localStorage read, just over the network.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running");
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(fetchJobs, 6000);
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, fetchJobs]);

  const submit = useCallback(async ({ workType, prompt, imageUrls, branding }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workType,
          prompt,
          imageUrls,
          // Per-generation branding (see branding.service.ts) - flat field
          // names matching what the backend reads from the request body.
          brandingLogoUrl: branding?.logoUrl,
          brandingAgencyName: branding?.agencyName,
          brandingContactInfo: branding?.contactInfo,
          brandingPrimaryColor: branding?.primaryColor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`);

      setJobs((prev) => [
        { jobId: data.jobId, workType, prompt, imageUrls, status: "running", createdAt: new Date().toISOString() },
        ...prev,
      ]);
      return { ok: true, jobId: data.jobId };
    } catch (err) {
      return { ok: false, error: err.message || "Failed to start generation" };
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { jobs, loading, error, submitting, submit, refresh: fetchJobs };
}
