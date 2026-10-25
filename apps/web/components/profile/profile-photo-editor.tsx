"use client";

import Image from "next/image";
import { Check, Upload } from "lucide-react";
import { AVATAR_PRESETS, avatarPresetIndex } from "@/lib/avatar-presets";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@scholau/api";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Draft = { file: File; url: string; width: number; height: number };
type Crop = { zoom: number; panX: number; panY: number };
const centered: Crop = { zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function ProfilePhotoEditor({ profile, onboarding = false, onInteractionChange }: { profile: Pick<Profile, "id" | "display_name" | "avatar_path">; onboarding?: boolean; onInteractionChange?: (active: boolean) => void }) {
  const router = useRouter();
  const cache = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [crop, setCrop] = useState<Crop>(centered);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ base: string | null; path: string | null } | null>(null);
  const path = saved?.base === profile.avatar_path ? saved.path : profile.avatar_path;
  const selectedPreset = avatarPresetIndex(path);
  const hasPhoto = Boolean(path?.startsWith("avatars/"));
  const draftUrl = draft?.url;
  useEffect(() => { onInteractionChange?.(busy || preparing || Boolean(draft) || removing); }, [busy, preparing, draft, removing, onInteractionChange]);
  useEffect(() => () => { if (draftUrl) URL.revokeObjectURL(draftUrl); }, [draftUrl]);
  useEffect(() => () => { generation.current++; }, []);

  async function choose(file?: File) {
    if (!file || locked.current) return;
    const gen = ++generation.current;
    setError(null); setNotice(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP photo. SVG and animated files are not supported."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Choose a photo up to 5 MB."); return; }
    setPreparing(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      if (generation.current !== gen) { URL.revokeObjectURL(url); return; }
      if (Math.min(image.naturalWidth, image.naturalHeight) < 96) throw new Error("SMALL_IMAGE");
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error("LARGE_IMAGE");
      setCrop(centered); setDraft({ file, url, width: image.naturalWidth, height: image.naturalHeight });
    } catch (error) {
      URL.revokeObjectURL(url);
      if (generation.current === gen) setError(error instanceof Error && error.message === "SMALL_IMAGE" ? "Choose a photo at least 96 pixels wide and tall." : error instanceof Error && error.message === "LARGE_IMAGE" ? "Choose a photo up to 40 megapixels." : "This image could not be opened. Choose another photo.");
    } finally { if (generation.current === gen) setPreparing(false); }
  }

  function applyAvatar(avatarPath: string | null) {
    setSaved({ base: profile.avatar_path, path: avatarPath });
    cache.setQueryData<Profile>(["scholau", "profile"], current => current ? { ...current, avatar_path: avatarPath } : current);
    for (const key of ["profile", "leaderboard", "battle", "admin", "social", "public-profile"]) {
      void cache.invalidateQueries({ queryKey: ["scholau", key] });
    }
    router.refresh();
  }

  async function selectAvatar(index: number) {
    if (locked.current || preparing || draft || index === selectedPreset) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/account/photo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatarIndex: index, expectedPath: path }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message || "Your avatar could not be saved."); return; }
      if (avatarPresetIndex(result.avatarPath) === null) throw new Error("INVALID_RESPONSE");
      applyAvatar(result.avatarPath);
      setNotice("Avatar saved.");
    } catch { setError("Your avatar could not be saved. Please try again."); }
    finally { locked.current = false; setBusy(false); }
  }

  async function save(remove = false) {
    if (locked.current || (!remove && !draft)) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      let response: Response;
      if (remove) response = await fetch("/api/account/photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedPath: path }) });
      else {
        const form = new FormData();
        form.set("file", draft!.file); form.set("crop", JSON.stringify(crop)); form.set("expectedPath", path ?? "");
        response = await fetch("/api/account/photo", { method: "POST", body: form });
      }
      const result = await response.json();
      if (!response.ok) { setError(result.message || "Your photo could not be saved. Please try again."); return; }
      if (result.avatarPath !== null && typeof result.avatarPath !== "string") throw new Error("INVALID_RESPONSE");
      applyAvatar(result.avatarPath); setDraft(null); setRemoving(false);
      setNotice(remove ? "Photo removed. Your avatar is restored." : "Profile photo updated.");
    } catch { setError("The change could not be confirmed. Reload your profile before retrying."); }
    finally { locked.current = false; setBusy(false); }
  }

  const imageWidth = draft ? draft.width / Math.min(draft.width, draft.height) * crop.zoom : 1;
  const imageHeight = draft ? draft.height / Math.min(draft.width, draft.height) * crop.zoom : 1;

  return <section aria-label="Profile picture" className="flex flex-col gap-4">
    <div className="avatar-picker-current"><Avatar name={profile.display_name} path={path} size={72} /><div><p className="font-semibold">{onboarding ? (hasPhoto ? "Your photo" : `${AVATAR_PRESETS[selectedPreset ?? 0]?.name ?? "Your"} avatar`) : "Your profile picture"}</p><p className="text-sm text-ink-muted">{onboarding ? "You can change this anytime." : "Pick an avatar or upload a photo."}</p></div></div>
    <fieldset className="avatar-picker" disabled={busy || preparing || Boolean(draft)} aria-busy={busy}>
      <legend className="sr-only">Choose an avatar</legend>
      <div className="avatar-picker-grid">{AVATAR_PRESETS.map(preset => <button type="button" key={preset.id} className="avatar-picker-option" data-selected={selectedPreset === preset.id} aria-label={`${preset.name} avatar`} aria-pressed={selectedPreset === preset.id} onClick={() => void selectAvatar(preset.id)}>
        <Avatar name={preset.name} path={preset.path} size={56} />
        <span>{preset.name}</span>
        {selectedPreset === preset.id ? <span className="avatar-picker-check" aria-hidden="true"><Check size={11} strokeWidth={3} /></span> : null}
      </button>)}</div>
    </fieldset>
    <input ref={input} id={`photo-file-${profile.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose profile photo" tabIndex={-1} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file); }} />
    <div className="avatar-picker-upload"><Button variant="outline" loading={preparing} disabled={busy} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />{hasPhoto ? "Change photo" : "Upload photo"}</Button>{hasPhoto ? <Button variant="ghost" disabled={busy || preparing} onClick={() => { setError(null); setRemoving(true); }}>Remove photo</Button> : null}<p>JPG, PNG or WebP · Up to 5 MB</p></div>
    {error && !draft && !removing && <Alert tone="error" role="alert">{error}</Alert>}
    {notice && <Alert tone="success" role="status">{notice}</Alert>}

    <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !locked.current) { setDraft(null); setError(null); } }}>
      <DialogContent hideClose={busy}>
        <DialogTitle>Adjust your photo</DialogTitle>
        <DialogDescription>Drag the photo or use the controls to position it. The circle previews how your photo will appear.</DialogDescription>
        {draft && <>
          <div role="img" aria-label="Profile photo crop preview" className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-control bg-surface-page" style={{ touchAction: "none", cursor: busy ? "wait" : "grab" }}
            onPointerDown={event => { if (locked.current) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, panX: crop.panX, panY: crop.panY }; }}
            onPointerMove={event => { const start = drag.current; if (!start || locked.current) return; const width = event.currentTarget.clientWidth; const maxX = (imageWidth - 1) * width / 2; const maxY = (imageHeight - 1) * width / 2; setCrop(value => ({ ...value, panX: maxX ? clamp(start.panX + (event.clientX - start.x) / maxX) : 0, panY: maxY ? clamp(start.panY + (event.clientY - start.y) / maxY) : 0 })); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <Image src={draft.url} alt="" unoptimized width={draft.width} height={draft.height} draggable={false} className="pointer-events-none absolute left-1/2 top-1/2 select-none" style={{ width: `${imageWidth * 100}%`, height: `${imageHeight * 100}%`, maxWidth: "none", transform: `translate(${-50 + crop.panX * 50 * (1 - 1 / imageWidth)}%, ${-50 + crop.panY * 50 * (1 - 1 / imageHeight)}%)` }} />
            <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-white" style={{ boxShadow: "0 0 0 100px rgb(0 0 0 / 40%)" }} />
          </div>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4"><legend className="sr-only">Photo positioning controls</legend>
            <Field id="photo-zoom" label="Zoom"><input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={event => setCrop(value => ({ ...value, zoom: Number(event.target.value) }))} className="min-h-11 w-full" /></Field>
            <Field id="photo-pan-x" label="Horizontal position"><input type="range" min="-1" max="1" step="0.01" value={crop.panX} onChange={event => setCrop(value => ({ ...value, panX: Number(event.target.value) }))} className="min-h-11 w-full" /></Field>
            <Field id="photo-pan-y" label="Vertical position"><input type="range" min="-1" max="1" step="0.01" value={crop.panY} onChange={event => setCrop(value => ({ ...value, panY: Number(event.target.value) }))} className="min-h-11 w-full" /></Field>
            <Button variant="ghost" onClick={() => setCrop(centered)}>Reset crop</Button>
          </fieldset>
        </>}
        {error && <Alert tone="error" role="alert">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setDraft(null); setError(null); }}>Cancel</Button><Button loading={busy} onClick={() => void save()}>Save photo</Button></div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={removing} onOpenChange={open => { if (!locked.current) { setRemoving(open); setError(null); } }} title="Remove profile photo?" description="Your selected avatar will be restored. You can upload another photo later." confirmLabel="Remove photo" destructive loading={busy} onConfirm={() => void save(true)}>
      {error && <Alert tone="error" role="alert">{error}</Alert>}
    </ConfirmDialog>
  </section>;
}
