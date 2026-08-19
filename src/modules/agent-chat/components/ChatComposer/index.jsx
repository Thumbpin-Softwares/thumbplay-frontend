"use client";

import { useRef, useState } from "react";
import { Loader2, Send, User, Home, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_PHOTOS = 4;

// Same upload endpoint/response shape as creative-ad-generator's uploadImage
// - avatar and property photos both land in the shared Asset library.
async function uploadImage(file, name) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  const res = await fetch("/api/model-tour/upload/property", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.asset?.url) throw new Error(data.error || "Upload failed");
  return data.asset.url;
}

function PhotoStrip({ label, icon: Icon, photos, onAdd, onRemove, disabled }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] text-neutral-400">
        <Icon className="w-3 h-3" /> {label}
      </span>
      {photos.map((p) => (
        <div key={p.id} className="relative w-8 h-8 rounded-md overflow-hidden border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.previewUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
          {p.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="w-3 h-3 animate-spin text-white" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 text-white flex items-center justify-center"
          >
            <X className="w-2 h-2" />
          </button>
        </div>
      ))}
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="w-8 h-8 rounded-md border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 text-sm"
        >
          +
        </button>
      )}
    </div>
  );
}

// Text input plus two small photo-attach strips (presenter/avatar and
// property) - kept separate rather than one undifferentiated attach button
// so the backend can label each explicitly for the model, matching the
// avatar/property distinction used everywhere else in this app.
export function ChatComposer({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [avatarPhotos, setAvatarPhotos] = useState([]);
  const [propertyPhotos, setPropertyPhotos] = useState([]);
  const avatarInputRef = useRef(null);
  const propertyInputRef = useRef(null);

  const addPhotos = async (files, setPhotos, label) => {
    const toAdd = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS));
    for (const file of toAdd) {
      const previewUrl = URL.createObjectURL(file);
      const entry = { id: crypto.randomUUID(), previewUrl, name: file.name, uploading: true, r2Url: null };
      setPhotos((prev) => [...prev, entry]);
      try {
        const url = await uploadImage(file, label);
        setPhotos((prev) => prev.map((p) => (p.id === entry.id ? { ...p, uploading: false, r2Url: url } : p)));
      } catch (err) {
        setPhotos((prev) => prev.filter((p) => p.id !== entry.id));
        console.error(`[ChatComposer] ${label} upload failed:`, err);
      }
    }
  };

  const hasUploading = avatarPhotos.some((p) => p.uploading) || propertyPhotos.some((p) => p.uploading);
  const canSend = !disabled && !hasUploading && text.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    onSend({
      text: text.trim(),
      avatarImageUrls: avatarPhotos.filter((p) => p.r2Url).map((p) => p.r2Url),
      propertyImageUrls: propertyPhotos.filter((p) => p.r2Url).map((p) => p.r2Url),
    });
    setText("");
    setAvatarPhotos([]);
    setPropertyPhotos([]);
  };

  return (
    <div className="border-t border-[#c7f038]/10 bg-white/70 p-3 backdrop-blur-sm flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <PhotoStrip
          label="Presenter"
          icon={User}
          photos={avatarPhotos}
          disabled={disabled}
          onAdd={() => avatarInputRef.current?.click()}
          onRemove={(id) => setAvatarPhotos((prev) => prev.filter((p) => p.id !== id))}
        />
        <PhotoStrip
          label="Property"
          icon={Home}
          photos={propertyPhotos}
          disabled={disabled}
          onAdd={() => propertyInputRef.current?.click()}
          onRemove={(id) => setPropertyPhotos((prev) => prev.filter((p) => p.id !== id))}
        />
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addPhotos(e.target.files, setAvatarPhotos, "Presenter Photo");
            e.target.value = "";
          }}
        />
        <input
          ref={propertyInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addPhotos(e.target.files, setPropertyPhotos, "Property Photo");
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Describe your property, or answer the assistant's question…"
          className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#c7f038] focus:ring-4 focus:ring-[#c7f038]/10"
        />
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="h-11 w-11 shrink-0 rounded-2xl bg-[#c7f038] p-0 text-black shadow-sm hover:bg-[#b7df33]"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
