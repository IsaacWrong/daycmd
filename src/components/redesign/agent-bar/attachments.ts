import type { Attachment } from "../useAgent";

export const MAX_ATTACH_BYTES = 20 * 1024 * 1024;

export async function fileToAttachment(file: File): Promise<Attachment | null> {
  if (file.size > MAX_ATTACH_BYTES) return null;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const type = file.type || "";
  if (type.startsWith("image/")) {
    const data = bytesToBase64(bytes);
    return { kind: "image", mediaType: type, data, name: file.name };
  }
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const data = bytesToBase64(bytes);
    return {
      kind: "document",
      mediaType: "application/pdf",
      data,
      name: file.name,
    };
  }
  const text = new TextDecoder().decode(bytes);
  return { kind: "text", data: text, name: file.name };
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
