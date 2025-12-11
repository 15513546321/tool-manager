/**
 * Utility function to convert Base64 string to Uint8Array.
 * Handles standard base64 strings and Data URLs.
 */
export const base64ToUint8Array = (base64String: string): Uint8Array => {
  const base64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Utility function to decode Base64 content to UTF-8 string.
 * Solves the issue of garbled text (mojibake) when displaying non-Latin characters.
 */
export const decodeBase64Content = (base64String: string): string => {
  try {
    const bytes = base64ToUint8Array(base64String);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error("Failed to decode base64 content", e);
    return "Error decoding content. Ensure it is a valid text file.";
  }
};