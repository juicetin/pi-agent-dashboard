// ---------------------------------------------------------------------------
// useImagePaste — reusable clipboard-image-paste state + handler.
//
// Extracted from CommandInput so the OpenSpec Explore dialog (and any
// future textareas) can accept pasted screenshots/mockups with the same
// behavior: supported-mime gate, 10MB cap, base64 data URLs, auto-
// dismissing error message, array of pending images ready to ship in a
// send_prompt's `images` field.
//
// Behavior:
//   - Supported MIME types: image/jpeg, image/png, image/gif, image/webp
//   - Max size: 10 MB of base64 (≈7.5 MB of raw bytes)
//   - On unsupported/oversized paste: set `imageError` for 3 s, ignore the blob
//   - On successful paste: append to `pendingImages`
//   - `clearImages()` is meant to be called by the consumer after sending
//     so the UI resets.
//
// The returned `handlePaste` swallows the clipboard event with
// preventDefault when an image is handled, preventing the base64 data
// URL from being inserted as text into the textarea — same guarantee
// the original CommandInput logic gave.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import type { ImageContent } from "@blackbelt-technology/pi-dashboard-shared/types.js";

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB base64
export const SUPPORTED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
]);

export interface UseImagePasteResult {
	/** Accumulated pasted images ready to attach to a send_prompt. */
	pendingImages: ImageContent[];
	/** Transient error message; auto-clears after 3s. null when idle. */
	imageError: string | null;
	/** Clipboard paste handler — attach to the textarea's onPaste. */
	handlePaste: (e: React.ClipboardEvent) => void;
	/** Remove the image at index `i` from pendingImages. */
	removeImage: (index: number) => void;
	/** Clear everything — call after a successful send. */
	clearImages: () => void;
}

export function useImagePaste(): UseImagePasteResult {
	const [pendingImages, setPendingImages] = useState<ImageContent[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);

	const handlePaste = useCallback((e: React.ClipboardEvent) => {
		const items = e.clipboardData.items;
		for (const item of items) {
			if (!item.type.startsWith("image/")) continue;

			e.preventDefault();
			// Capture mimeType eagerly — DataTransferItem may become invalid
			// after the event handler returns.
			const mimeType = item.type;

			if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
				setImageError(`Unsupported image type: ${mimeType}. Use JPEG, PNG, GIF, or WebP.`);
				setTimeout(() => setImageError(null), 3000);
				continue;
			}

			const blob = item.getAsFile();
			if (!blob) continue;

			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = reader.result as string;
				const base64 = dataUrl.split(",")[1];
				if (!base64) return;

				if (base64.length > MAX_IMAGE_SIZE) {
					setImageError("Image too large (max 10MB)");
					setTimeout(() => setImageError(null), 3000);
					return;
				}

				setPendingImages((prev) => [...prev, { type: "image", data: base64, mimeType }]);
			};
			reader.readAsDataURL(blob);
		}
	}, []);

	const removeImage = useCallback((index: number) => {
		setPendingImages((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const clearImages = useCallback(() => {
		setPendingImages([]);
		setImageError(null);
	}, []);

	return { pendingImages, imageError, handlePaste, removeImage, clearImages };
}
