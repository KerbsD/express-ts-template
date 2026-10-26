export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

// Folder names double as the first path segment in the storage bucket, so this
// allowlist is also what keeps client input out of the object path.
export const UPLOAD_FOLDERS = ["portfolio", "merch", "design", "misc"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export const isUploadFolder = (value: unknown): value is UploadFolder =>
  typeof value === "string" &&
  (UPLOAD_FOLDERS as readonly string[]).includes(value);
