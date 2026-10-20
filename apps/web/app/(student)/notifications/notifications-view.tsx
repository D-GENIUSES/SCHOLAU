"use client";

import { Bell, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Notification } from "@scholau/api";
import { useMarkNotificationRead, useNotifications } from "@scholau/api/react";
import { formatDateTime, formatRelative } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, InlineError, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

function internalTarget(target: string | null): string | null {
  return target && target.startsWith("/") && !target.startsWith("//") ? target : null;
}

function NotificationItem({ item, onOpen }: { item: Notification; onOpen: (item: Notification) => void }) {
  const unread = item.read_at === null;
  const target = internalTarget(item.safe_target);
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Bell className="size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-ink", unread && "font-semibold")}>{item.body}</span>
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)} className="text-sm text-ink-muted">
          {formatRelative(item.created_at)}
        </time>
      </span>
      {unread ? <Badge tone="brand">Unread</Badge> : null}
      {target ? <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden /> : null}
    </>
  );
  const className = cn("flex w-full items-center gap-3 px-4 py-3 text-left", unread && "border-l-4 border-blue-600 bg-blue-50");

  if (!target && !unread) return <div className={className}>{content}</div>;
  return (
    <button type="button" className={cn(className, "min-h-14 hover:bg-surface-page")} onClick={() => onOpen(item)}>
      {content}
      {!target ? <span className="sr-only">Mark as read</span> : null}
    </button>
  );
}

export function NotificationsView() {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();

  if (notifications.isPending) return <LoadingState label="Loading notifications…" />;
  if (notifications.isError) return <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />;

  const items = notifications.data;
  const unreadCount = items.filter((n) => n.read_at === null).length;

  const open = (item: Notification) => {
    if (item.read_at === null) markRead.mutate({ notificationId: item.id });
    const target = internalTarget(item.safe_target);
    if (target) router.push(target);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" loading={markRead.isPending && markRead.variables?.all === true} onClick={() => markRead.mutate({ all: true })}>
              Mark all as read
            </Button>
          ) : null
        }
      />
      <InlineError error={markRead.error} className="mb-4" />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications yet" description="Updates about your account and activity will appear here." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationItem item={item} onOpen={open} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
