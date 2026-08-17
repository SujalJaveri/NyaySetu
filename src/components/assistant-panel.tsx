import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileSearch, Loader2, MessageSquareText, SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EXAMPLE_QUESTIONS, type AssistantAnswer, type AssistantRow } from "@/lib/assistant";
import { askRegistryAssistant } from "@/lib/assistant.functions";

type Turn =
  | { role: "user"; id: string; text: string }
  | { role: "assistant"; id: string; answer: AssistantAnswer }
  | { role: "error"; id: string; text: string };

/**
 * Registry Assistant — a decision-support lookup panel. Every answer is the
 * result of a real query against the live registry; unmatched questions are
 * declined rather than guessed at. Conversation is session-only by design.
 */
export function AssistantPanel() {
  const navigate = useNavigate();
  const askFn = useServerFn(askRegistryAssistant);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setValue("");
    setTurns((prev) => [...prev, { role: "user", id: `u-${Date.now()}`, text: q }]);
    setBusy(true);
    try {
      const answer = await askFn({ data: { question: q } });
      setTurns((prev) => [...prev, { role: "assistant", id: `a-${Date.now()}`, answer }]);
    } catch (error) {
      setTurns((prev) => [
        ...prev,
        {
          role: "error",
          id: `e-${Date.now()}`,
          text: error instanceof Error ? error.message : "The registry lookup failed.",
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function openRow(row: AssistantRow) {
    if (!row.target) return;
    setOpen(false);
    const t = row.target;
    if (t.route === "/cases/$caseId") navigate({ to: t.route, params: { caseId: t.caseId } });
    else if (t.route === "/judges/$judgeId")
      navigate({ to: t.route, params: { judgeId: t.judgeId } });
    else if (t.route === "/courtrooms/$courtroomId")
      navigate({ to: t.route, params: { courtroomId: t.courtroomId } });
    else navigate({ to: t.route });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Registry Assistant">
          <MessageSquareText className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileSearch className="size-4 text-gold" />
            Registry Assistant
          </SheetTitle>
          <SheetDescription className="text-xs">
            Answers come from live queries against cases, judges, availability and schedules.
            Unsupported questions are declined rather than guessed.
          </SheetDescription>
        </SheetHeader>
        <Separator />

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-5 py-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Try one of these lookups:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {turn.text}
                  </p>
                </div>
              ) : turn.role === "error" ? (
                <p
                  key={turn.id}
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {turn.text}
                </p>
              ) : (
                <div
                  key={turn.id}
                  className="space-y-2 rounded-lg border border-border bg-card p-3"
                >
                  <p className="text-sm font-medium text-foreground">{turn.answer.summary}</p>
                  {turn.answer.rows.length > 0 && (
                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                      {turn.answer.rows.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => openRow(row)}
                            disabled={!row.target}
                            className={cn(
                              "flex w-full items-start justify-between gap-2 px-3 py-2 text-left",
                              row.target ? "transition-colors hover:bg-muted" : "cursor-default",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-foreground">
                                {row.label}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {row.detail}
                              </span>
                            </span>
                            {row.badge && (
                              <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                                {row.badge}
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-muted-foreground">Source: {turn.answer.source}</p>
                </div>
              ),
            )}

            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Querying the registry…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <Separator />
        <form
          className="flex items-center gap-2 px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(value);
          }}
        >
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask about cases, judges, availability…"
            aria-label="Ask the Registry Assistant"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !value.trim()}
            aria-label="Send question"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
