"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Renders the finished, combined video (combine_video tool result).
export function FinalVideoCard({ data }) {
  if (!data?.resultUrl) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden p-3 flex flex-col gap-2 max-w-[220px]">
      <div className="relative aspect-9/16 rounded-lg overflow-hidden bg-neutral-950">
        <video src={data.resultUrl} className="absolute inset-0 w-full h-full object-cover" controls />
      </div>
      <Button size="sm" asChild>
        <a href={data.resultUrl} download target="_blank" rel="noreferrer">
          <Download className="w-3.5 h-3.5" /> Download
        </a>
      </Button>
    </div>
  );
}
