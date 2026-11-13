/** Storage buckets and path rules. Buckets enforce size/MIME server-side (DATABASE §11). */

export const AVATAR_BUCKET = "avatars";
export const STUDENT_DOCUMENT_BUCKET = "student-documents";
export const SERVICE_MEDIA_BUCKET = "service-media";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  "application/pdf": "pdf",
} as const;

type TypeMap = Readonly<Record<string, string>>;

/** Returns an Indonesian error message, or null when the file is acceptable. */
export function validateUpload(
  file: { type: string; size: number },
  allowed: TypeMap,
): string | null {
  if (!(file.type in allowed)) {
    const list = Object.values(allowed).join(", ").toUpperCase();
    return `Format file harus ${list}.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Ukuran file maksimal 5 MB.";
  if (file.size === 0) return "File kosong.";
  return null;
}

/** `{uid}/{random-uuid}.{ext}`; the extension comes from the MIME allow-list, never the filename. */
export function buildObjectPath(
  uid: string,
  mimeType: string,
  allowed: TypeMap,
  randomId: string = crypto.randomUUID(),
): string | null {
  const ext = allowed[mimeType];
  return ext ? `${uid}/${randomId}.${ext}` : null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** True only for paths produced by buildObjectPath for this user. */
export function isOwnObjectPath(
  uid: string,
  path: string,
  allowed: TypeMap,
): boolean {
  const exts = [...new Set(Object.values(allowed))].join("|");
  const pattern = new RegExp(`^${UUID}/${UUID}\\.(?:${exts})$`);
  return pattern.test(path) && path.startsWith(`${uid}/`);
}

export function publicObjectUrl(
  supabaseUrl: string,
  bucket: string,
  path: string,
): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
