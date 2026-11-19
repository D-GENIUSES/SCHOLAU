"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, Download, Pause, Play, RotateCcw, ScanLine, Trash2 } from "lucide-react";
import type { LecturerOffering } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

type ScanRecord = { id: string; student_name: string; department: string; matric_number: string; score: string; confidence: number; needs_review: boolean; created_at: string };
type ScanSession = { offering_id: string; status: "scanning" | "paused"; created_at: string; records: ScanRecord[] };
const STORAGE_KEY = "scholau:lecturer:exam-scan:v1";

function loadSession(): ScanSession | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as ScanSession;
    if (typeof parsed.offering_id !== "string" || !Array.isArray(parsed.records)) return null;
    return { ...parsed, status: parsed.status === "scanning" ? "scanning" : "paused" };
  } catch { return null; }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xmlEscape(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }
function htmlEscape(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }

function grouped(records: ScanRecord[]) {
  const map = new Map<string, ScanRecord[]>();
  for (const record of records) {
    const department = record.department.trim() || "Department not identified";
    map.set(department, [...(map.get(department) ?? []), record]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function LecturerScanWorkspace({ courses }: { courses: LecturerOffering[] }) {
  const [session, setSession] = useState<ScanSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [offeringId, setOfferingId] = useState(courses[0]?.id ?? "");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanError, setScanError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentCourse = courses.find(course => course.id === (session?.offering_id ?? offeringId));
  const departments = useMemo(() => grouped(session?.records ?? []), [session?.records]);

  useEffect(() => { const restored = loadSession(); if (restored) { setSession(restored); setOfferingId(restored.offering_id); } setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (!session) { localStorage.removeItem(STORAGE_KEY); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => setCameraError("Could not start the camera preview."));
  }, [cameraOpen]);

  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("Camera access is unavailable here. Use Take photo / choose file below."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream; setCameraOpen(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setCameraError("Camera permission was denied. Allow camera access for ScholAu in your browser or device settings, then select Open camera again.");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") setCameraError("No camera was found on this device. Use Take photo / choose file instead.");
      else if (name === "NotReadableError" || name === "TrackStartError") setCameraError("The camera is being used by another app. Close that app and select Open camera again.");
      else if (!window.isSecureContext) setCameraError("Camera access requires a secure connection. Open ScholAu using HTTPS or localhost.");
      else setCameraError("The browser could not open the camera. Check camera permissions or use Take photo / choose file below.");
    }
  }

  function startSession() {
    if (!offeringId) return;
    setScanError("");
    setSession({ offering_id: offeringId, status: "scanning", created_at: new Date().toISOString(), records: [] });
    void openCamera();
  }

  async function scanPhoto(file: File) {
    if (!session || processing) return;
    if (!file.type.startsWith("image/")) { setScanError("Choose an image from the camera or gallery."); return; }
    setProcessing(true); setScanError("");
    const tempId = crypto.randomUUID();
    const placeholder: ScanRecord = { id: tempId, student_name: "", department: "", matric_number: "", score: "", confidence: 0, needs_review: true, created_at: new Date().toISOString() };
    setSession(current => current ? { ...current, records: [...current.records, placeholder] } : current);
    try {
      const bitmap = await createImageBitmap(file);
      const cropHeight = Math.max(1, Math.round(bitmap.height * 0.5));
      const scale = Math.min(1, 1500 / bitmap.width);
      const canvas = canvasRef.current!; canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(cropHeight * scale);
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare this photo.");
      context.drawImage(bitmap, 0, 0, bitmap.width, cropHeight, 0, 0, canvas.width, canvas.height); bitmap.close();
      const image = canvas.toDataURL("image/jpeg", 0.82);
      const response = await fetch("/api/lecturer-scan/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offeringId: session.offering_id, image }) });
      const data = await response.json() as { student_name?: string | null; department?: string | null; matric_number?: string | null; score?: string | null; confidence?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not read this exam header.");
      const record: ScanRecord = { ...placeholder, student_name: data.student_name ?? "", department: data.department ?? "", matric_number: data.matric_number ?? "", score: data.score ?? "", confidence: data.confidence ?? 0, needs_review: !data.student_name || !data.department || !data.matric_number || !data.score || (data.confidence ?? 0) < 0.7 };
      setSession(current => current ? { ...current, records: current.records.map(item => item.id === tempId ? record : item) } : current);
    } catch (error) {
      setSession(current => current ? { ...current, records: current.records.filter(item => item.id !== tempId) } : current);
      setScanError(error instanceof Error ? error.message : "Could not read this exam header. Try again or enter it manually.");
    } finally { setProcessing(false); }
  }

  function capture() {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const height = video.videoHeight; const scale = Math.min(1, 1500 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d"); if (!context) return;
    context.drawImage(video, 0, 0, video.videoWidth, height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (blob) void scanPhoto(new File([blob], "exam-header.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.82);
  }

  function updateRecord(id: string, field: "student_name" | "department" | "matric_number" | "score", value: string) {
    setSession(current => current ? { ...current, records: current.records.map(record => {
      if (record.id !== id) return record;
      const updated = { ...record, [field]: value };
      return { ...updated, needs_review: !updated.student_name.trim() || !updated.department.trim() || !updated.matric_number.trim() || !updated.score.trim() };
    }) } : current);
  }

  function removeRecord(id: string) { setSession(current => current ? { ...current, records: current.records.filter(record => record.id !== id) } : current); }

  async function exportExcel() {
    if (!session?.records.length) return;
    setExporting(true);
    try {
      const sheets: string[] = [];
      const used = new Set<string>();
      for (const [department, records] of departments) {
        let base = department.replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31) || "Department";
        let name = base; let index = 2; while (used.has(name.toLowerCase())) { const suffix = ` (${index++})`; name = `${base.slice(0, 31 - suffix.length)}${suffix}`; }
        used.add(name.toLowerCase());
        const rows = [[currentCourse?.code ?? "Course", currentCourse?.title ?? ""], ["Department", department], [], ["Student name", "Matriculation number", "Score"], ...records.map(record => [record.student_name, record.matric_number, record.score])];
        const worksheetRows = rows.map((row, rowIndex) => `<Row>${row.map(cell => `<Cell${rowIndex === 3 ? ' ss:StyleID="Header"' : ""}><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`).join("");
        sheets.push(`<Worksheet ss:Name="${xmlEscape(name)}"><Table>${worksheetRows}</Table></Worksheet>`);
      }
      const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>${sheets.join("")}</Workbook>`;
      downloadBlob(new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }), `scholau-scan-${new Date().toISOString().slice(0, 10)}.xls`);
    } catch { setScanError("Excel export could not be created. Please try again."); }
    finally { setExporting(false); }
  }

  async function exportWord() {
    if (!session?.records.length) return;
    setExporting(true);
    try {
      const sections = departments.map(([department, records]) => `<h2>${htmlEscape(department)}</h2><table><thead><tr><th>Student name</th><th>Matriculation number</th><th>Score</th></tr></thead><tbody>${records.map(record => `<tr><td>${htmlEscape(record.student_name)}</td><td>${htmlEscape(record.matric_number)}</td><td>${htmlEscape(record.score)}</td></tr>`).join("")}</tbody></table>`).join("");
      const document = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1{font-size:20pt}h2{margin-top:24pt}table{border-collapse:collapse;width:100%;margin-bottom:18pt}th,td{border:1px solid #8793a4;padding:6pt;text-align:left}th{background:#eaf2ff}</style></head><body><h1>${htmlEscape(currentCourse?.code ?? "Course")} · ${htmlEscape(currentCourse?.title ?? "Exam results")}</h1>${sections}</body></html>`;
      downloadBlob(new Blob([document], { type: "application/msword;charset=utf-8" }), `scholau-scan-${new Date().toISOString().slice(0, 10)}.doc`);
    } catch { setScanError("Word export could not be created. Please try again."); }
    finally { setExporting(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Scan exam papers</h1><p className="mt-1 text-sm text-ink-muted">Scan each paper header. Review extracted details, then export results by department.</p></div>{session ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${session.status === "scanning" ? "bg-success-bg text-success" : "bg-surface-tint text-ink-muted"}`}>{session.status === "scanning" ? "Session active" : "Paused · saved on this device"}</span> : null}</header>

    {!session ? <section className="space-y-3 rounded-card border border-line bg-surface-card p-4"><h2 className="font-semibold">Start a scan session</h2><label className="block text-sm font-medium">Course<NativeSelect className="mt-1" value={offeringId} onChange={event => setOfferingId(event.target.value)}><option value="">Select a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title} · {course.department}</option>)}</NativeSelect></label><Button disabled={!offeringId || !courses.length} onClick={startSession}><ScanLine className="size-4" aria-hidden />Start scanning</Button><p className="text-xs text-ink-muted">Sessions and extracted rows are saved in this browser. Photos are cropped to the top half and sent securely for reading; image files are not kept.</p></section> : <>
      <section className="space-y-3 rounded-card border border-line bg-surface-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{currentCourse?.code} · {currentCourse?.title}</p><p className="text-xs text-ink-muted">{session.records.length} paper{session.records.length === 1 ? "" : "s"} scanned · started {new Date(session.created_at).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{session.status === "scanning" ? <Button variant="outline" onClick={() => { stopCamera(); setSession(current => current ? { ...current, status: "paused" } : current); }}><Pause className="size-4" aria-hidden />Pause</Button> : <Button onClick={() => { setSession(current => current ? { ...current, status: "scanning" } : current); void openCamera(); }}><Play className="size-4" aria-hidden />Continue</Button>}{session.records.length ? <><Button variant="outline" disabled={exporting} loading={exporting} onClick={() => void exportExcel()}><Download className="size-4" aria-hidden />Excel</Button><Button variant="outline" disabled={exporting} loading={exporting} onClick={() => void exportWord()}><Download className="size-4" aria-hidden />Word</Button></> : null}<Button variant="ghost" aria-label="Start a new scan session" onClick={() => { if (window.confirm("Start a new session? Export or finish reviewing this session first.")) { stopCamera(); setSession(null); } }}><RotateCcw className="size-4" aria-hidden />New session</Button></div></div>
        {session.status === "scanning" ? <><p className="text-sm text-ink-muted">Frame the top of the paper so the name, department, matric number, and red mark are visible.</p>{cameraOpen ? <div className="space-y-2"><video ref={videoRef} className="max-h-[55vh] w-full rounded-control bg-black object-contain" playsInline muted aria-label="Exam paper camera preview"/><Button disabled={processing} loading={processing} onClick={capture}><Camera className="size-4" aria-hidden />Scan next paper</Button></div> : <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void openCamera()}><Camera className="size-4" aria-hidden />Open camera</Button><label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line px-4 text-sm font-semibold hover:bg-surface-page">Take photo / choose file<input className="sr-only" type="file" accept="image/*" capture="environment" disabled={processing} onChange={event => { const file = event.target.files?.[0]; if (file) void scanPhoto(file); event.currentTarget.value = ""; }}/></label></div>}</> : null}
        {cameraError ? <p role="status" className="text-sm text-warning">{cameraError}</p> : null}{scanError ? <p role="alert" className="flex items-start gap-2 text-sm text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{scanError}</p> : null}<canvas ref={canvasRef} className="hidden"/></section>

      <section className="space-y-3"><div><h2 className="text-lg font-bold">Review scanned results</h2><p className="text-sm text-ink-muted">Check low-confidence reads and correct any details before exporting. Department names determine the export sheets.</p></div>{!session.records.length ? <p className="rounded-card border border-dashed border-line p-5 text-center text-sm text-ink-muted">Scanned papers will appear here.</p> : null}{departments.flatMap(([department, records]) => records.map(record => <article key={record.id} className="space-y-3 rounded-card border border-line bg-surface-card p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="font-semibold">{record.student_name || "Paper details"}</h3>{record.needs_review ? <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">Review needed</span> : null}</div><Button variant="ghost" size="sm" aria-label="Remove scanned paper" onClick={() => removeRecord(record.id)}><Trash2 className="size-4" aria-hidden/>Remove</Button></div>{!record.id ? null : <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-medium">Student name<Input className="mt-1" value={record.student_name} onChange={event => updateRecord(record.id, "student_name", event.target.value)} /></label><label className="text-xs font-medium">Department<Input className="mt-1" value={record.department} placeholder={department} onChange={event => updateRecord(record.id, "department", event.target.value)} /></label><label className="text-xs font-medium">Matriculation number<Input className="mt-1" value={record.matric_number} onChange={event => updateRecord(record.id, "matric_number", event.target.value)} /></label><label className="text-xs font-medium">Score exactly as marked<Input className="mt-1" value={record.score} onChange={event => updateRecord(record.id, "score", event.target.value)} /></label></div>}{record.confidence > 0 ? <p className="text-xs text-ink-muted">Reading confidence: {Math.round(record.confidence * 100)}%</p> : null}</article>))}</section>
    </>}
  </div>;
}
