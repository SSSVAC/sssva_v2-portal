// Optional, zero-dependency failure notification. Disabled unless
// SYNC_ALERT_WEBHOOK_URL is set, so it's safe to leave unconfigured. The
// payload includes both `text` (Slack incoming webhooks) and `content`
// (Discord webhooks) so the same env var works with either without extra
// config — unknown keys are ignored by both platforms.
export async function notifySyncFailure(message: string) {
  const webhookUrl = process.env.SYNC_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = `SSSVA Portal: Zoho Books sync failed — ${message}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: controller.signal
    });

    clearTimeout(timeout);
  } catch (error) {
    // Never let a broken webhook fail the sync it's reporting on.
    console.error("[alerts] failed to send sync-failure notification", error);
  }
}
