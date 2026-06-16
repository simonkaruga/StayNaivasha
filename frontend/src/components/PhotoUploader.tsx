/**
 * Instagram-style photo/video uploader.
 *
 * - Accepts ANY file type the browser can read (JPEG, PNG, WebP, HEIC/HEIF
 *   from iPhone, screenshots, WhatsApp downloads, MP4, MOV, AVI, etc.)
 * - Converts HEIC → JPEG client-side before uploading
 * - Compresses large images automatically (max 4 MB, 2400px)
 * - Shows local preview instantly — no waiting for upload
 * - Parallel uploads with per-tile progress ring
 * - Drag-and-drop zone + tap to open file picker
 * - Drag-to-reorder tiles (long-press on mobile)
 * - Tap a tile to set it as the cover photo
 * - Remove individual photos with × button
 */
import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { Camera, Film, UploadCloud, X, Star } from "lucide-react";

export interface UploadedPhoto {
  url: string;       // Cloudinary secure_url (set after upload)
  localUrl: string;  // blob: preview shown immediately
  progress: number;  // 0–100
  done: boolean;
  error: boolean;
  isVideo: boolean;
}

interface Props {
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
}

const CLOUD  = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD  ?? "";
const PRESET = (import.meta as any).env?.VITE_CLOUDINARY_PRESET ?? "staynaivasha";

// ── File normaliser (HEIC → JPEG, compression) ─────────────────────────────

async function normaliseFile(file: File): Promise<{ blob: Blob; isVideo: boolean; mime: string }> {
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name);
  if (isVideo) return { blob: file, isVideo: true, mime: file.type || "video/mp4" };

  const isHeic = file.type === "image/heic" || file.type === "image/heif"
    || /\.(heic|heif)$/i.test(file.name);

  let blob: Blob = file;
  let mime = file.type || "image/jpeg";

  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.88 });
      blob = Array.isArray(converted) ? converted[0] : converted;
      mime = "image/jpeg";
    } catch {
      // heic2any failed — upload raw and let Cloudinary handle it
    }
  }

  // Compress if > 3 MB
  if (blob.size > 3 * 1024 * 1024) {
    try {
      const compress = (await import("browser-image-compression")).default;
      blob = await compress(new File([blob], file.name, { type: mime }), {
        maxSizeMB: 2.5,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
        fileType: mime,
      });
    } catch { /* leave uncompressed */ }
  }

  return { blob, isVideo: false, mime };
}

// ── Per-file XHR upload with progress ──────────────────────────────────────

function uploadToCloudinary(
  blob: Blob,
  isVideo: boolean,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const resource = isVideo ? "video" : "image";
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("upload_preset", PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD}/${resource}/upload`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}

// ── Progress ring ───────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 18; const circ = 2 * Math.PI * r;
  return (
    <svg className="absolute inset-0 m-auto" width={44} height={44}>
      <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
      <circle cx={22} cy={22} r={r} fill="none" stroke="white" strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dashoffset 0.2s" }}
      />
      <text x={22} y={26} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{pct}%</text>
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function PhotoUploader({ value, onChange, maxPhotos = 20 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [dragSrcIdx,   setDragSrcIdx]   = useState<number | null>(null);

  // Keep a stable ref to the latest photos so parallel upload callbacks can mutate it correctly
  const latestRef = useRef<UploadedPhoto[]>(value);
  useEffect(() => { latestRef.current = value; }, [value]);

  const updateAt = useCallback((idx: number, patch: Partial<UploadedPhoto>) => {
    const next = latestRef.current.map((p, j) => j === idx ? { ...p, ...patch } : p);
    latestRef.current = next;
    onChange(next);
  }, [onChange]);

  const processFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;

    // Create placeholder entries with local previews immediately
    const placeholders: UploadedPhoto[] = files.map(f => ({
      url: "",
      localUrl: URL.createObjectURL(f),
      progress: 0,
      done: false,
      error: false,
      isVideo: f.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name),
    }));

    const startIdx = latestRef.current.length;
    const combined = [...latestRef.current, ...placeholders];
    latestRef.current = combined;
    onChange(combined);

    // Upload all in parallel
    await Promise.all(files.map(async (file, i) => {
      const idx = startIdx + i;
      try {
        const { blob, isVideo } = await normaliseFile(file);

        const cloudUrl = await uploadToCloudinary(blob, isVideo, pct => {
          updateAt(idx, { progress: pct });
        });

        updateAt(idx, { url: cloudUrl, progress: 100, done: true });
      } catch {
        updateAt(idx, { error: true, done: true });
      }
    }));
  }, [onChange, updateAt]);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = ""; // allow same file re-selection
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDraggingOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function remove(i: number) {
    const p = value[i];
    URL.revokeObjectURL(p.localUrl);
    onChange(value.filter((_, j) => j !== i));
  }

  function makePrimary(i: number) {
    if (i === 0) return;
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.unshift(item);
    onChange(next);
  }

  // Drag-to-reorder
  function onTileDragStart(e: DragEvent, i: number) {
    setDragSrcIdx(i);
    e.dataTransfer.effectAllowed = "move";
  }
  function onTileDragOver(e: DragEvent, i: number) {
    e.preventDefault();
    if (dragSrcIdx === null || dragSrcIdx === i) return;
    const next = [...value];
    const [item] = next.splice(dragSrcIdx, 1);
    next.splice(i, 0, item);
    setDragSrcIdx(i);
    onChange(next);
  }

  const canAdd = value.length < maxPhotos;

  return (
    <div className="space-y-3">
      {/* Drop zone / add button */}
      <div
        onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={onDrop}
        onClick={() => canAdd && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-8 cursor-pointer transition-all select-none ${
          draggingOver
            ? "border-[var(--color-teal)] bg-[var(--color-teal)]/5 scale-[1.01]"
            : canAdd
              ? "border-[var(--border)] hover:border-[var(--color-teal)] hover:bg-[var(--color-teal)]/3"
              : "border-[var(--border)] opacity-50 cursor-not-allowed"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          // Accept everything — let normaliseFile handle conversion
          accept="image/*,video/*,.heic,.heif,.HEIC,.HEIF,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.mp4,.mov,.avi,.mkv,.webm,.m4v"
          onChange={onFileInput}
          disabled={!canAdd}
        />

        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Camera size={24} />
          <span className="text-[#1a1008]/30">·</span>
          <Film size={22} />
          <span className="text-[#1a1008]/30">·</span>
          <UploadCloud size={22} />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {draggingOver ? "Drop to upload" : "Tap to add photos or videos"}
          </p>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            Any format — iPhone HEIC, WhatsApp, screenshots, MP4, anything
          </p>
          <p className="text-[12px] text-[var(--text-muted)]/70 mt-0.5">
            Drag &amp; drop also works · {value.length}/{maxPhotos} added
          </p>
        </div>

        {draggingOver && (
          <div className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: "rgba(24,104,120,0.06)" }} />
        )}
      </div>

      {/* Photo grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((p, i) => (
            <div
              key={p.localUrl}
              draggable
              onDragStart={e => onTileDragStart(e, i)}
              onDragOver={e => onTileDragOver(e, i)}
              onDragEnd={() => setDragSrcIdx(null)}
              className={`relative aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing ${
                i === 0 ? "ring-2 ring-[var(--color-forest)]" : ""
              } ${dragSrcIdx === i ? "opacity-50 scale-95" : "opacity-100"} transition-all`}
            >
              {/* Preview */}
              {p.isVideo
                ? <video src={p.localUrl} className="w-full h-full object-cover" muted playsInline />
                : <img src={p.localUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              }

              {/* Upload progress overlay */}
              {!p.done && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                  <ProgressRing pct={p.progress} />
                </div>
              )}

              {/* Error state */}
              {p.error && (
                <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-1">
                  <X size={20} className="text-white" />
                  <p className="text-white text-[11px] font-semibold">Failed</p>
                </div>
              )}

              {/* Cover badge */}
              {i === 0 && p.done && !p.error && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-[11px] bg-[var(--color-forest)] text-white py-1 font-semibold">
                  Cover photo
                </span>
              )}

              {/* Set as cover (tap star) */}
              {i !== 0 && p.done && !p.error && (
                <button type="button" onClick={() => makePrimary(i)}
                  className="absolute bottom-1 left-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  title="Set as cover">
                  <Star size={12} className="text-white" />
                </button>
              )}

              {/* Remove */}
              <button type="button" onClick={() => remove(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/55 rounded-full flex items-center justify-center transition-transform active:scale-90">
                <X size={13} className="text-white" />
              </button>

              {/* Video badge */}
              {p.isVideo && (
                <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Film size={9} /> Video
                </span>
              )}
            </div>
          ))}

          {/* Inline add more tile */}
          {canAdd && (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:border-[var(--color-teal)] transition-colors">
              <span className="text-2xl leading-none font-light">+</span>
              <span className="text-[11px]">Add more</span>
            </button>
          )}
        </div>
      )}

      {/* Guidance */}
      {value.length > 0 && value.length < 8 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <Camera size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-[13px] text-amber-700">
            Add {8 - value.length} more photo{8 - value.length !== 1 ? "s" : ""} —
            listings with 8+ photos get <strong>3× more bookings</strong>
          </p>
        </div>
      )}
      {value.length >= 8 && (
        <p className="text-[13px] text-[var(--color-teal)] text-center">
          Great selection! Drag tiles to reorder · tap ★ to set cover photo
        </p>
      )}
    </div>
  );
}
