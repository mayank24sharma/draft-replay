// Client-side crypto utilities adhering strictly to spec:
// - Document IDs: 128+ bits random (22+ chars base64url)
// - WriteKey: 32 random bytes base64url (crypto.getRandomValues)
// - KeyHash: SHA-256 of writeKey in hex (server never sees plain write key)

export function generateDocId(): string {
  const bytes = new Uint8Array(18); // 144 bits > 128 bits
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function generateWriteKey(): string {
  const bytes = new Uint8Array(32); // 256 bits
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function generateUUID(): string {
  if (typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

export async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
