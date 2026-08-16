import { WEEKDAYS, formatHours, type UtilisationRow } from "@/lib/utilisation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function intensity(hours: number, peak: number) {
  if (hours <= 0 || peak <= 0) return 0;
  // Keep low-but-nonzero cells visible.
  return 0.18 + 0.82 * (hours / peak);
}

export function UtilisationHeatmap({
  rows,
  peak,
  emptyLabel,
}: {
  rows: UtilisationRow[];
  peak: number;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground" />
                {WEEKDAYS.map((d) => (
                  <th
                    key={d}
                    className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {d}
                  </th>
                ))}
                <th className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="max-w-40 truncate pr-2 text-left text-sm font-medium text-foreground"
                    title={row.name}
                  >
                    {row.name}
                  </th>
                  {row.hours.map((hours, i) => (
                    <td key={i} className="p-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex h-9 min-w-9 items-center justify-center rounded-md border border-border text-[11px] font-medium tabular-nums"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(
                                intensity(hours, peak) * 100,
                              )}%, transparent)`,
                              color:
                                intensity(hours, peak) > 0.55
                                  ? "var(--primary-foreground)"
                                  : "var(--muted-foreground)",
                            }}
                          >
                            {hours > 0 ? Math.round(hours * 10) / 10 : ""}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.name} · {WEEKDAYS[i]} · {formatHours(hours)} booked
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  ))}
                  <td className="px-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatHours(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span
              key={f}
              className="size-4 rounded-sm border border-border"
              style={{
                backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(
                  intensity(f * peak, peak) * 100,
                )}%, transparent)`,
              }}
            />
          ))}
          <span>More</span>
          <span className="ml-2">Peak {formatHours(peak)} on a single day</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
