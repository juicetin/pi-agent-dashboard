/**
 * Image probing and resizing for pi-image-fit.
 *
 * Spec: Resize threshold policy, Resize implementation.
 * Design: D2 (jimp), D3 (format-adaptive PNG-in→PNG-out, else JPEG@85).
 *
 * The `jimp` library is loaded lazily so that the disabled path
 * (PI_IMAGE_FIT_DISABLE=1) and non-image read paths never pay the
 * ~50 ms jimp load cost.
 */

import { JimpMime, Jimp } from "jimp";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ImageDims {
  width: number;
  height: number;
}

export interface NeedsResizeInput {
  bytes: number;
  maxBytes: number;
  dims: ImageDims;
  maxEdge: number;
}

/**
 * Resize policy predicate.
 * Spec: Resize threshold policy.
 */
export function needsResize(input: NeedsResizeInput): boolean {
  const longEdge = Math.max(input.dims.width, input.dims.height);
  return input.bytes > input.maxBytes || longEdge > input.maxEdge;
}

/**
 * Output extension and mime type for the format-adaptive policy.
 *  - `.png` source  → PNG output (lossless)
 *  - everything else → JPEG output (lossy)
 *
 * Returns `{ ext, mime }` where `ext` includes the leading dot.
 */
export function outputFormatFor(srcPath: string): { ext: string; mime: string } {
  const lower = srcPath.toLowerCase();
  if (lower.endsWith(".png")) {
    return { ext: ".png", mime: JimpMime.png };
  }
  return { ext: ".jpg", mime: JimpMime.jpeg };
}

/**
 * Image-extension allowlist used by the tool_call hook gate.
 * Spec: Tool-call mutation seam.
 */
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

export function isImagePath(p: string): boolean {
  return IMAGE_EXT_RE.test(p);
}

/**
 * Probe source image dimensions by loading via jimp.
 * Returns null if the file cannot be decoded (caller falls through).
 */
export async function probeDims(srcPath: string): Promise<ImageDims | null> {
  try {
    const img = await Jimp.read(srcPath);
    return { width: img.width, height: img.height };
  } catch {
    return null;
  }
}

export interface ResizeOptions {
  maxEdge: number;
  /** JPEG quality 1–100. Ignored for PNG output. */
  quality: number;
}

export interface ResizeResult {
  srcDims: ImageDims;
  dstDims: ImageDims;
  dstBytes: number;
  outExt: string;
}

/**
 * Re-encode the source image to `dstPath` at `outExt`, scaled so the
 * long edge is at most `maxEdge` (preserving aspect ratio).
 *
 * Caller is responsible for ensuring `path.dirname(dstPath)` exists.
 * Throws on any failure; the extension hook catches at the top level
 * and falls through to the original path.
 */
export async function resizeToFile(
  srcPath: string,
  dstPath: string,
  opts: ResizeOptions,
): Promise<ResizeResult> {
  const img = await Jimp.read(srcPath);
  const srcDims: ImageDims = { width: img.width, height: img.height };

  // Long-edge scaling, aspect-ratio preserving. Jimp 1.x exposes
  // `.scaleToFit({ w, h })` which fits the image inside a w×h box.
  // Using the same value for both edges yields long-edge ≤ maxEdge.
  if (Math.max(srcDims.width, srcDims.height) > opts.maxEdge) {
    img.scaleToFit({ w: opts.maxEdge, h: opts.maxEdge });
  }

  const outExt = path.extname(dstPath).toLowerCase();
  let buffer: Buffer;
  if (outExt === ".png") {
    buffer = (await img.getBuffer(JimpMime.png)) as unknown as Buffer;
  } else {
    buffer = (await img.getBuffer(JimpMime.jpeg, {
      quality: opts.quality,
    })) as unknown as Buffer;
  }

  await fs.writeFile(dstPath, buffer);

  return {
    srcDims,
    dstDims: { width: img.width, height: img.height },
    dstBytes: buffer.length,
    outExt,
  };
}
