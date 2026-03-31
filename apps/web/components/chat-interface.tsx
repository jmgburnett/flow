"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// Simple markdown-ish rendering: bold, bullet lists, line breaks
function renderMessage(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bullet list items
    if (line.match(/^[\s]*[-•]\s/)) {
      const content = line.replace(/^[\s]*[-•]\s/, "");
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="text-muted-foreground">•</span>
          <span>{renderInline(content)}</span>
        </div>,
      );
      continue;
    }

    // Numbered list items
    if (line.match(/^[\s]*\d+\.\s/)) {
      const match = line.match(/^[\s]*(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-1.5 ml-1">
            <span className="text-muted-foreground">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </div>,
        );
        continue;
      }
    }

    // Empty line = paragraph break
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular line
    elements.push(<div key={i}>{renderInline(line)}</div>);
  }

  return <>{elements}</>;
}

function renderInline(text: string) {
  // Handle **bold** and *italic*
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(
          <span key={key++}>{remaining.slice(0, boldMatch.index)}</span>,
        );
      }
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // No more matches
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

export function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load persisted messages from Convex
  const storedMessages = useQuery(api.chat.getMessages, {
    limit: 50,
  });
  const processMessage = useAction(api.chat.processMessage);

  function fmt(d: Date) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [storedMessages, sending]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const userMsg = message.trim();
    setMessage("");
    setSending(true);

    try {
      await processMessage({ message: userMsg });
    } catch (error) {
      console.error("Chat error:", error);
      // The error will show in the console; messages are persisted so UI updates via query
    } finally {
      setSending(false);
    }
  };

  // Combine stored messages with a default greeting if empty
  const displayMessages =
    storedMessages && storedMessages.length > 0
      ? storedMessages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          time: fmt(new Date(msg.timestamp)),
        }))
      : [
          {
            role: "assistant" as const,
            content:
              "Hey Josh! I'm Flobot — your AI Chief of Staff. I can check your calendar, find open slots, and schedule meetings. What do you need?",
            time: fmt(new Date()),
          },
        ];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-2xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all active:scale-95 z-50"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[560px] glass-heavy md:rounded-2xl md:shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
              F
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold tracking-tight">Flobot</p>
            <p className="text-[10px] text-muted-foreground">
              AI Chief of Staff
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
        {displayMessages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-muted-foreground mb-1">
                  {msg.time}
                </span>
                <div className="max-w-[80%] rounded-2xl rounded-tr-lg px-4 py-2.5 bg-primary text-primary-foreground">
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-1">
                  <Avatar className="h-4 w-4">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      F
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground">
                    {msg.time}
                  </span>
                </div>
                <div className="max-w-[85%] pl-5">
                  <div className="text-sm leading-relaxed text-foreground">
                    {renderMessage(msg.content)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                  F
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground">
                thinking...
              </span>
            </div>
            <div className="pl-5 flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 border-t border-border/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1 glass rounded-xl px-2 py-1"
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Schedule a meeting, check calendar..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5 px-1"
          />
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              message.trim() && !sending
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground/40",
            )}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
