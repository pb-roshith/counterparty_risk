import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { askRiskCopilot, type RiskCopilotReply } from "@/lib/api";
import { useAppState } from "@/state/app-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { question: string; reply?: RiskCopilotReply; error?: string };

export function RiskCopilotPage() {
  const { counterpartyId, company } = useAppState();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    setQuestion("");
    setBusy(true);
    setMessages((current) => [...current, { question: prompt }]);
    try {
      const reply = await askRiskCopilot(prompt, counterpartyId);
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, reply } : item));
    } catch (error) {
      setMessages((current) => current.map((item, index) => index === current.length - 1
        ? { ...item, error: error instanceof Error ? error.message : "Request failed." } : item));
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto flex max-w-4xl flex-col gap-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Graph and record retrieval</p>
      <h1 className="mt-1 text-2xl font-semibold">Risk Copilot</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ask about {company.name}, or mention another manufactured counterparty by name or ID. Answers use synthetic PostgreSQL records and available graph connections.</p>
    </div>
    <div className="min-h-[380px] space-y-5 rounded-lg border bg-surface p-4" aria-live="polite">
      {messages.length === 0 && <div className="space-y-2 text-sm text-muted-foreground">
        <p>Try “What is the risk score and exposure?”</p>
        <p>Or “Which entities are connected to this counterparty?”</p>
      </div>}
      {messages.map((message, index) => <div key={index} className="space-y-3">
        <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">{message.question}</div>
        <div className="max-w-[90%] rounded-lg border bg-background px-4 py-3 text-sm">
          {message.reply?.answer ?? message.error ?? "Retrieving records…"}
          {message.reply && <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {message.reply.limitations.map((item) => <p key={item}>{item}</p>)}
            <p className="font-semibold text-foreground">Citations</p>
            {message.reply.sources.length === 0 && <p>No source records retrieved.</p>}
            {message.reply.sources.map((source) => <p key={`${source.store}-${source.label}-${source.id}`}>{source.store} · {source.label} · {source.id}</p>)}
          </div>}
        </div>
      </div>)}
    </div>
    <form onSubmit={(event) => void submit(event)} className="flex items-end gap-2">
      <Textarea aria-label="Ask Risk Copilot" placeholder="Ask about risk, exposure, or relationships…" maxLength={1000}
        value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-20 flex-1" />
      <Button type="submit" disabled={!question.trim() || busy} className="gap-2"><Send className="size-4" />{busy ? "Searching" : "Send"}</Button>
    </form>
  </div>;
}
