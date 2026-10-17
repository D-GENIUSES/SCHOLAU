export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preserve the existing <course>/<lesson>/<file> contract, with no URL or traversal. */
export function validLessonAssetPath(path: string): boolean {
  if (!path || path.length > 1024 || /[\\\u0000-\u001f\u007f?#%]/.test(path)) return false;
  const parts = path.split("/");
  return parts.length >= 3 && UUID_PATTERN.test(parts[0]!) && UUID_PATTERN.test(parts[1]!) &&
    parts.slice(2).every(part => part.length > 0 && part !== "." && part !== "..");
}
