/** Opens the phone's share sheet, or copies the text where there isn't one. */
export async function shareText(title: string, text: string, url?: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return "copied";
  } catch {
    return "failed";
  }
}
