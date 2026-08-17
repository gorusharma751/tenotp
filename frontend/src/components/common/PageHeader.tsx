import type { ReactNode } from "react";
export function PageHeader({ title, description, actions, action }: { title: string; description?: string; actions?: ReactNode; action?: ReactNode }) {
  const trailing = actions ?? action;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="truncate text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
