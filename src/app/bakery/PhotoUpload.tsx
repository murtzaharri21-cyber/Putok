"use client";

import { useRef, useState } from "react";

export default function PhotoUpload({ source, version }: { source: "upload" | "fallback"; version: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [v, setV] = useState(version);
  const [src, setSrc] = useState(source);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setMsg("That isn't an image.");
      return;
    }
    setFile(f);
    setMsg(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch("/api/texture", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setV(data.version);
      setSrc("upload");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setMsg("Saved. The 3D putok on the shop front now wears this photo.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    setBusy(true);
    await fetch("/api/texture", { method: "DELETE" });
    setSrc("fallback");
    setV(Date.now());
    setMsg("Back to the stock photo.");
    setBusy(false);
  }

  return (
    <section id="photo" className="rule-thick mt-16 pt-8">
      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="mono text-ink-soft">The putok photo</div>
          <h2 className="display mt-2 text-4xl">
            Whatever you put here is what <span className="italic-display">spins on the shop front.</span>
          </h2>
          <p className="mt-4 text-ink-soft">
            Two uploads work. A single photo of the top, straight from above on a plain background —
            the wall and base are generated to match. Or the <strong>three-view sheet</strong>:
            scored top filling the bottom half, flat base top-left, side edge top-right — the site
            slices it and wraps each view onto the correct part of the 3D loaf.
          </p>
          <p className="mono mt-4 text-ink-soft">
            Currently: {src === "upload" ? "your uploaded photo" : "stock photo"}
          </p>
        </div>

        <div className="md:col-span-3">
          <div className="mono mb-2 text-ink-soft">Current</div>
          {src === "upload" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/texture?v=${v}`}
                alt="Your uploaded putok photo"
                className="aspect-square w-full border border-ink/30 object-contain bg-paper-deep"
              />
            </>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center border border-dashed border-ink/40 bg-paper-deep p-6 text-center text-sm text-ink-soft">
              The default putok is drawn in 3D to match the reference — ring, docking lines and all.
              Upload a photo to use your own.
            </div>
          )}
          {src === "upload" && (
            <button
              type="button"
              onClick={revert}
              disabled={busy}
              className="mono mt-3 underline decoration-apricot underline-offset-4 disabled:opacity-50"
            >
              Revert to stock photo
            </button>
          )}
        </div>

        <div className="md:col-span-5">
          <div className="mono mb-2 text-ink-soft">New photo</div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center border border-dashed p-6 text-center transition ${
              drag ? "border-apricot bg-apricot/10" : "border-ink/50 hover:bg-paper-deep"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected" className="max-h-full max-w-full object-contain" />
            ) : (
              <>
                <span className="display text-3xl">Drop the photo here</span>
                <span className="mt-2 text-ink-soft">or click to choose · JPG, PNG, WebP · up to 12 MB</span>
              </>
            )}
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={upload}
              disabled={!file || busy}
              className="btn-ink rounded-full px-6 py-3"
            >
              {busy ? "Saving…" : "Use this photo"}
            </button>
            {file && (
              <span className="mono text-ink-soft">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
          {msg && <p className="mt-3 text-apricot">{msg}</p>}
        </div>
      </div>
    </section>
  );
}
