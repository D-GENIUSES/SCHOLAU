"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function StreakShare({ days }: { days: number }) {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<{ file: File; url: string; days: number } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const count = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  const caption = `I'm on a ${count}-day learning streak on SCHOLAU! One day at a time. https://scholau.com`;

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let url: string | undefined;
    const image = canvas.current;
    const ctx = image?.getContext("2d");
    if (!image || !ctx) return;
    ctx.fillStyle = "#0066dc";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillText("SCHOLAU", 540, 130);
    // Vector flame avoids relying on platform-specific emoji fonts.
    ctx.save();
    ctx.translate(420, 245);
    ctx.scale(10, 10);
    ctx.fillStyle = "#ffbd59";
    ctx.fill(new Path2D("M12 0C14 7 23 9 23 17A11 11 0 0 1 1 17C1 12 4 8 7 6C6 12 10 13 10 9Z"));
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${count > 9999 ? 150 : 220}px system-ui, sans-serif`;
    ctx.fillText(String(count), 540, 780, 920);
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.fillText(count === 1 ? "DAY STREAK" : "DAYS STREAK", 540, 890);
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText("One day at a time. Look how far I've come.", 540, 1030, 930);
    ctx.font = "bold 38px system-ui, sans-serif";
    ctx.fillText("Keep learning with me", 540, 1160);
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText("scholau.com", 540, 1220);
    image.toBlob((blob) => {
      if (disposed) return;
      if (!blob) { setStatus("Image unavailable. You can still copy your caption."); return; }
      url = URL.createObjectURL(blob);
      setAsset({ file: new File([blob], `scholau-${count}-day-streak.png`, { type: "image/png" }), url, days: count });
    }, "image/png");
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [open, count]);

  async function share() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (!navigator.share) {
        setStatus("Save your image and upload it to your favourite social app.");
      } else if (asset && asset.days === count && navigator.canShare?.({ files: [asset.file] })) {
        await navigator.share({ files: [asset.file], title: "My SCHOLAU streak" });
      } else {
        await navigator.share({ title: "My SCHOLAU streak", text: caption });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("Sharing wasn't available. Save the image or copy the caption instead.");
      }
    } finally { setBusy(false); }
  }

  if (count === 0) return null;
  const ready = asset?.days === count ? asset : null;
  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); setStatus(""); setAsset(null); }}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Share your streak"><Share2 aria-hidden /></Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Share your streak</DialogTitle>
        <DialogDescription>You showed up for {count} {count === 1 ? "day" : "days"}. Let your friends see your progress.</DialogDescription>
        <canvas ref={canvas} width={1080} height={1350} role="img" aria-label={`${count}-day SCHOLAU learning streak`} className="mx-auto w-full max-w-[240px] rounded-2xl" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={share} loading={busy} disabled={!ready}><Share2 aria-hidden />Share streak</Button>
          <Button variant="outline" disabled={!ready} onClick={() => {
            if (!ready) return;
            const link = document.createElement("a"); link.href = ready.url; link.download = ready.file.name;
            document.body.appendChild(link); link.click(); link.remove();
          }}><Download aria-hidden />Save image</Button>
          <Button variant="ghost" onClick={async () => {
            try { await navigator.clipboard.writeText(caption); setStatus("Caption copied."); }
            catch { setStatus("Couldn't copy automatically. Select and copy the caption below."); }
          }}><Copy aria-hidden />Copy caption</Button>
        </div>
        <p className="select-text text-sm text-ink-muted">{caption}</p>
        <p className="text-xs text-ink-muted">Choose an available app from your phone’s share menu, or save the image to post to stories, status updates and feeds.</p>
        <p role="status" className="text-sm text-ink-muted">{status}</p>
      </DialogContent>
    </Dialog>
  );
}
