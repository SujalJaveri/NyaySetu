import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  showLabel?: boolean;
};

export function BrandMark({ className, imageClassName, showLabel = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "nyayasetu-mark flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-card ring-1 ring-border",
        className,
      )}
      aria-label="NyayaSetu"
    >
      <img
        src="/nyayasetu-logo.png"
        alt={showLabel ? "NyayaSetu logo" : ""}
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </span>
  );
}
