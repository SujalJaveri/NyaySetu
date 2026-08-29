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
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl border-l border-border/80 bg-background shadow-2xl"
      >
        <SheetHeader className="px-5 py-4 pr-12 border-b bg-card/60">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <FileSearch className="size-4.5 text-primary" />
            AI Registry Copilot
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground leading-normal">
            Ask any custom question about court cases, judge workloads, schedules, or legal procedures. Powered by Gemini 3.5 Flash.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 w-full min-w-0 [&>[data-radix-scroll-area-viewport]]:!block">
          <div className="space-y-4 p-5 w-full min-w-0 max-w-full">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Try one of these lookups:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="rounded-lg border border-border/80 bg-card/80 px-3 py-1.5 text-left text-xs text-foreground transition-all hover:bg-accent hover:border-primary/40 hover:text-accent-foreground"
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
                  <p className="max-w-[85%] rounded-2xl rounded-br-xs bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm leading-relaxed break-words">
                    {turn.text}
                  </p>
                </div>
              ) : turn.role === "error" ? (
                <p
                  key={turn.id}
                  className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive leading-relaxed break-words"
                >
                  {turn.text}
                </p>
              ) : (
                <div
                  key={turn.id}
                  className="space-y-3 rounded-2xl rounded-tl-xs border border-border/80 bg-card/90 p-4 shadow-sm min-w-0 max-w-full overflow-hidden"
                >
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {turn.answer.summary}
                  </div>
                  {turn.answer.rows.length > 0 && (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background/50">
                      {turn.answer.rows.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => openRow(row)}
                            disabled={!row.target}
                            className={cn(
                              "flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                              row.target ? "hover:bg-muted/70 cursor-pointer" : "cursor-default",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {row.label}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground mt-0.5">
                                {row.detail}
                              </span>
                            </span>
                            {row.badge && (
                              <Badge variant="outline" className="shrink-0 text-[10px] font-normal px-2 py-0.5">
                                {row.badge}
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            )}

            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-1">
                <Loader2 className="size-4 animate-spin text-primary" /> Querying the legal engine & registry…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <form
          className="flex items-center gap-2 p-4 border-t border-border/80 bg-card/40 shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(value);
          }}
        >
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask anything about cases, schedules, judges, or procedures…"
            aria-label="Ask the AI Copilot"
            className="flex-1 min-w-0 text-sm h-10 bg-background/80 focus-visible:ring-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !value.trim()}
            aria-label="Send question"
            className="h-10 w-10 shrink-0"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
