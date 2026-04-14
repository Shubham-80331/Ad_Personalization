import { sniffMediaTypeFromBytes, type ImageMediaType } from "@/lib/sniff-image";

const ALLOWED = new Set<ImageMediaType>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type AdImagePayload = {
  base64: string;
  mediaType: ImageMediaType;
};

function normalizeContentType(ct: string | null): ImageMediaType | null {
  if (!ct) return null;
  const base = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED.has(base as ImageMediaType)) return base as ImageMediaType;
  if (base === "image/jpg") return "image/jpeg";
  return null;
}

export async function loadRemoteImage(url: string): Promise<AdImagePayload> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch image URL (${res.status})`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image too large (max 12MB)");
  }
  const fromHeader = normalizeContentType(res.headers.get("content-type"));
  const sniffed = sniffMediaTypeFromBytes(buf);
  const mediaType = fromHeader ?? sniffed;
  if (!mediaType) {
    throw new Error("Unsupported image type from URL");
  }
  return {
    base64: Buffer.from(buf).toString("base64"),
    mediaType,
  };
}
