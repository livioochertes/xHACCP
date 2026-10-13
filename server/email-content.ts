/** SendGrid rejects empty content parts; omit formats that are not supplied. */
export function nonEmptyEmailContent(text?: string, html?: string) {
  return {
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  };
}
