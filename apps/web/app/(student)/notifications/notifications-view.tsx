"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Notification } from "@scholau/api";
import { useClearNotifications, useMarkNotificationRead, useNotifications } from "@scholau/api/react";
import { formatDateTime, formatRelative } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { InvitationsPanel } from "@/components/battle/invitations-panel";

function internalTarget(target: string | null): string | null {
  return target && target.startsWith("/") && !target.startsWith("//") ? target : null;
}

function NotificationItem({ item, onOpen }: { item: Notification; onOpen: (item: Notification) => void }) {
  const unread = item.read_at === null;
  const target = internalTarget(item.safe_target);
  const content = (
    <>
      <span className="inbox-copy">
        <p>{item.body}</p>
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>{formatRelative(item.created_at)}</time>
      </span>
      <span className="inbox-aside">
        {unread ? <span className="inbox-dot" role="img" aria-label="Unread" /> : null}
        {target ? <ChevronRight className="size-4 text-ink-muted" aria-hidden /> : null}
      </span>
    </>
  );
  const className = cn("inbox-row", unread && "is-unread");

  if (!target && !unread) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={className} onClick={() => onOpen(item)}>
      {content}
      {!target ? <span className="sr-only">Mark as read</span> : null}
    </button>
  );
}

export function NotificationsView({ settings }: { settings?: ReactNode }) {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const clear = useClearNotifications();

  useEffect(() => {
    const nextExpiry = notifications.data?.reduce((soonest, item) => {
      const expiry = Date.parse(item.expires_at);
      return expiry < soonest ? expiry : soonest;
    }, Number.POSITIVE_INFINITY);
    if (!nextExpiry || !Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => void notifications.refetch(), Math.max(0, nextExpiry - Date.now() + 250));
    return () => window.clearTimeout(timer);
  }, [notifications.data, notifications.refetch]);

  const items = notifications.data ?? [];
  const unreadCount = items.filter((n) => n.read_at === null).length;
  const summary = notifications.isPending
    ? "Loading your inbox"
    : notifications.isError
      ? "Inbox unavailable"
      : unreadCount > 0
        ? `${unreadCount} unread`
        : "You're up to date";

  const open = (item: Notification) => {
    if (item.read_at === null) markRead.mutate({ notificationId: item.id });
    const target = internalTarget(item.safe_target);
    if (target) router.push(target);
  };

  return (
    <>
      <header className="inbox-head">
        <div className="min-w-0">
          <h1>Notifications</h1>
          <p>{summary}</p>
        </div>
        {items.length > 0 ? (
          <div className="inbox-toolbar">
            {unreadCount > 0 ? <Button variant="outline" size="sm" loading={markRead.isPending && markRead.variables?.all === true} onClick={() => markRead.mutate({ all: true })}>Mark all read</Button> : null}
            <Button variant="outline" size="sm" loading={clear.isPending} onClick={() => clear.mutate()}>Clear</Button>
          </div>
        ) : null}
      </header>
      {settings}
      <InlineError error={markRead.error} />
      <InlineError error={clear.error} />
      <InvitationsPanel />
      {notifications.isPending ? <LoadingState variant="notifications" label="Loading notifications…" /> : null}
      {notifications.isError ? <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} /> : null}
      {!notifications.isPending && !notifications.isError && items.length === 0 ? (
        <EmptyState title="No notifications yet" description="Updates about your account and activity will appear here." />
      ) : null}
      {items.length > 0 ? (
        <section aria-label="Notification inbox" className="inbox-block">
          <h2 className="inbox-label">Inbox</h2>
          <ul className="inbox-list">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} onOpen={open} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
