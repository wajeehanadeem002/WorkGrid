interface DownloadOptions {
  contentType: string;
  filename: string;
  truncated: boolean;
}

export function contentDisposition(filename: string): string {
  const clean = filename.replace(/[\u0000-\u001f\u007f]/g, "");
  const fallback = clean
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "-");
  const encoded = encodeURIComponent(clean).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function createDownloadResponse(
  content: string,
  options: DownloadOptions,
): Response {
  const bytes = new TextEncoder().encode(content);
  const chunkSize = 64 * 1024;
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const nextOffset = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": options.contentType,
      "Content-Disposition": contentDisposition(options.filename),
      "Cache-Control": "private, no-store",
      "X-WorkGrid-Export-Truncated": String(options.truncated),
    },
  });
}
