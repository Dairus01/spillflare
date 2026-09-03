"use client";

import { DefaultChatTransport, isToolUIPart } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  BotMessageSquare,
  ChevronDown,
  LoaderCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const suggestedQuestions = [
  "What are the latest oil spill records?",
  "What is the latest gas flare value for Delta State?",
  "When was the data last retrieved?",
];

function renderInlineMarkdown(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-bold-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
  });
}

function renderAssistantText(text: string, messageId: string, partIndex: number) {
  return text.split(/\r?\n/).map((line, lineIndex) => {
    const key = `${messageId}-${partIndex}-${lineIndex}`;
    const bullet = line.match(/^\s*(?:\*|-)\s+(.+)$/);
    if (bullet) {
      return <li key={key}>{renderInlineMarkdown(bullet[1], key)}</li>;
    }
    if (!line.trim()) return <div className="assistant-message-break" key={key} />;
    return <p key={key}>{renderInlineMarkdown(line, key)}</p>;
  });
}

export function DataAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/data-assistant" }),
    throttle: 20,
  });
  const working = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, status]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || working) return;
    sendMessage({ text });
    setInput("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(input);
  }

  return (
    <div className="data-assistant">
      {open ? (
        <section className="assistant-panel" aria-label="Nigeria environmental data assistant">
          <header className="assistant-header">
            <div className="assistant-title"><span><BotMessageSquare size={18} /></span><div><strong>Data assistant</strong><small>Source-grounded answers</small></div></div>
            <button className="assistant-close" type="button" onClick={() => setOpen(false)} aria-label="Close data assistant"><X size={18} /></button>
          </header>
          <div className="assistant-conversation" aria-live="polite">
            {!messages.length ? (
              <div className="assistant-welcome">
                <div className="assistant-welcome-icon"><Sparkles size={18} /></div>
                <h2>Ask about Nigeria&apos;s oil spills or gas flares.</h2>
                <p>I check the current NOSDRA and Gas Flare Tracker snapshots, show what the records support, and keep missing values visible.</p>
                <div className="assistant-suggestions">{suggestedQuestions.map((question) => <button type="button" key={question} onClick={() => ask(question)}>{question}</button>)}</div>
              </div>
            ) : messages.map((message) => (
              <div className={`assistant-message ${message.role === "user" ? "is-user" : "is-assistant"}`} key={message.id}>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    const content = renderAssistantText(part.text, message.id, index);
                    const hasList = part.text.split(/\r?\n/).some((line) => /^\s*(?:\*|-)\s+/.test(line));
                    return hasList ? <ul key={`${message.id}-${index}`}>{content}</ul> : content;
                  }
                  if (isToolUIPart(part) && part.state !== "output-available") return <div className="assistant-tool" key={part.toolCallId}><LoaderCircle size={13} /> Checking source records…</div>;
                  return null;
                })}
              </div>
            ))}
            {working && status === "submitted" ? <div className="assistant-tool"><LoaderCircle size={13} /> Preparing an evidence-based answer…</div> : null}
            {error ? <p className="assistant-error">{error.message || "The assistant could not answer that just now. Please try again."}</p> : null}
            <div ref={messageEndRef} />
          </div>
          <form className="assistant-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="data-assistant-input">Ask a question about the data</label>
            <textarea id="data-assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a spill, state, company, block or flare trend…" rows={2} disabled={working} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(input); } }} />
            {working ? <button className="assistant-send" type="button" onClick={stop} aria-label="Stop response"><ChevronDown size={18} /></button> : <button className="assistant-send" type="submit" disabled={!input.trim()} aria-label="Send question"><Send size={17} /></button>}
          </form>
          <p className="assistant-note">Answers are limited to the available public source records. Not supplied never means zero.</p>
        </section>
      ) : null}
      <button className="assistant-launcher" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="data-assistant-panel"><BotMessageSquare size={20} /><span>Ask the data</span></button>
    </div>
  );
}
