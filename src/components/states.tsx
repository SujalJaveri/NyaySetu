import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shared loading / empty / error presentation for every data-driven screen. */

export function LoadingState({ label = "Loading registry records…" }: { label?: string }) {
  return (
    <Card className="mt-6 shadow-panel">
      <CardContent className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        {label}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <Card className="mt-6 border-dashed shadow-panel">
      <CardContent className="py-14 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title = "Could not load these records",
  error,
  onRetry,
  retrying,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The registry did not respond.";
  return (
    <Card className="mt-6 border-destructive/40 shadow-panel">
      <CardContent className="py-12 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        {onRetry && (
          <Button variant="outline" className="mt-5" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={retrying ? "size-4 animate-spin" : "size-4"} />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Inline banner for read-only users. */
export function PermissionNotice({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {message}
    </div>
  );
}
