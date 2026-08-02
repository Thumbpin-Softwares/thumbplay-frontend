"use client";

import Image from "next/image";

export default function CreativeTemplateCard({ template, onClick }) {
  const isComingSoon = !!template.comingSoon;

  const handleClick = () => {
    if (isComingSoon) return;
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isComingSoon}
      className={`group flex flex-col rounded-2xl border overflow-hidden bg-white text-left transition-all duration-300 ${
        isComingSoon
          ? "border-neutral-100 opacity-60 cursor-not-allowed"
          : "border-neutral-200 hover:border-neutral-400 hover:shadow-xl cursor-pointer"
      }`}
    >
      {/* MEDIA */}
      <div className="relative aspect-6/8">
        {template.image && (
          <Image
            src={template.image}
            alt={template.title}
            fill
            className="object-cover"
          />
        )}
      </div>

      <div className="px-3 py-2">
        <h4 className="text-sm font-semibold text-center text-black leading-snug">{template.title}</h4>
      </div>
    </button>
  );
}
