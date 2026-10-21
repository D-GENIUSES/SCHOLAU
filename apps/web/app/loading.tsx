/** Stream the app shell and splash while route/session data is still pending. */
export default function AppLoading() {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh place-items-center bg-surface-page p-6">
      <span role="status" className="inline-flex items-center gap-3 text-sm text-ink-muted">
        <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-line border-t-brand-primary motion-reduce:animate-none" />
        Opening ScholAu…
      </span>
    </main>
  );
}
