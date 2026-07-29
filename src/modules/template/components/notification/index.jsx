"use client";

import { toast } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2, AlertTriangle } from "lucide-react";

// Template-pipeline-branded toast presets — same black/lime look as the edit
// page's editNotify (client/src/modules/edit/components/notification), so
// every generation pipeline's notifications look visually consistent. Call
// these instead of the raw `toast` import from "sonner".
//
// Usage:
//   import { templateNotify } from "@/modules/template/components/notification";
//   templateNotify.success("Script generated");
//   templateNotify.error("Script generation failed", { description: err.message });

const baseOptions = {
  classNames: {
    toast: "!bg-neutral-900 !text-white !border-neutral-800",
    description: "!text-neutral-300",
    actionButton: "!bg-[#c7f038] !text-black",
    cancelButton: "!bg-neutral-800 !text-white",
  },
};

function success(message, options = {}) {
  return toast.success(message, {
    ...baseOptions,
    icon: <CheckCircle2 className="w-4 h-4 text-[#c7f038]" />,
    ...options,
  });
}

function error(message, options = {}) {
  return toast.error(message, {
    ...baseOptions,
    icon: <XCircle className="w-4 h-4 text-destructive" />,
    ...options,
  });
}

function info(message, options = {}) {
  return toast(message, {
    ...baseOptions,
    icon: <Info className="w-4 h-4 text-[#c7f038]" />,
    ...options,
  });
}

function warning(message, options = {}) {
  return toast.warning(message, {
    ...baseOptions,
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    ...options,
  });
}

function loading(message, options = {}) {
  return toast.loading(message, {
    ...baseOptions,
    icon: <Loader2 className="w-4 h-4 animate-spin text-[#c7f038]" />,
    ...options,
  });
}

function dismiss(id) {
  toast.dismiss(id);
}

export const templateNotify = {
  success,
  error,
  info,
  warning,
  loading,
  dismiss,
};
