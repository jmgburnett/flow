"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ─── Markdown Rendering ───

function renderMessage(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    elements.push(<div key={i}>{renderInline(line)}</div>);
  }

  return <>{elements}</>;
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
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
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

// ─── Suggestions ───

const SUGGESTIONS = [
  "What's my calendar look like today?",
  "Any urgent emails I need to handle?",
  "Schedule a meeting with Doug next week",
  "What did Carey email me about?",
];

// ─── Chat History Sidebar ───

function ChatHistory({
  activeId,
  onSelect,
  onNew,
  onClose,
}: {
  activeId: Id<"chat_conversations"> | null;
  onSelect: (id: Id<"chat_conversations">) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const conversations = useQuery(api.chat.listConversations, {
    limit: 30,
  });
  const deleteConversation = useMutation(api.chat.deleteConversation);

  function fmtDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0)
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold tracking-tight">Chat History</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {!conversations || conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        ) : (
          conversations.map((convo) => (
            <div
              key={convo._id}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                activeId === convo._id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent/50 text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(convo._id)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm truncate font-medium">{convo.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtDate(convo.updatedAt)}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this conversation?")) {
                    deleteConversation({ conversationId: convo._id });
                    if (activeId === convo._id) onNew();
                  }
                }}
                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent transition-all text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Home Chat ───

export function HomeChat() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeConversationId, setActiveConversationId] =
    useState<Id<"chat_conversations"> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storedMessages = useQuery(
    api.chat.getMessages,
    activeConversationId
      ? { conversationId: activeConversationId, limit: 50 }
      : { limit: 0 }, // Don't load messages when no conversation selected
  );
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

  const handleSend = async (text?: string) => {
    const msgText = text || message.trim();
    if (!msgText || sending) return;
    setMessage("");
    setSending(true);

    try {
      const result = await processMessage({
        conversationId: activeConversationId ?? undefined,
        message: msgText,
      });

      // If this was a new conversation, set the active ID
      if (!activeConversationId && result.conversationId) {
        setActiveConversationId(
          result.conversationId as Id<"chat_conversations">,
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessage("");
    setShowHistory(false);
  };

  const handleSelectConversation = (id: Id<"chat_conversations">) => {
    setActiveConversationId(id);
    setShowHistory(false);
  };

  const hasMessages =
    activeConversationId && storedMessages && storedMessages.length > 0;

  return (
    <div className="flex h-full">
      {/* History sidebar — desktop always visible, mobile toggle */}
      <div
        className={cn(
          "shrink-0 border-r border-border/30 bg-background/50",
          // Mobile: overlay
          showHistory
            ? "fixed inset-0 z-40 w-[280px] glass-heavy md:relative md:z-auto"
            : "hidden",
          // Desktop: always show
          "md:block md:w-[240px]",
        )}
      >
        <ChatHistory
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onClose={() => setShowHistory(false)}
        />
      </div>

      {/* Overlay backdrop on mobile */}
      {showHistory && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setShowHistory(false)}
          onKeyDown={() => {}}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground md:hidden"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-accent transition-colors text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight mb-1">
                What can I help with?
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                I can check your calendar, search emails, schedule meetings, and
                more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSend(suggestion)}
                    disabled={sending}
                    className="glass-card rounded-xl px-4 py-3 text-left text-sm text-foreground hover:bg-accent/50 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {storedMessages.map((msg, i) => (
                <div key={msg._id ?? i}>
                  {msg.role === "user" ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground mb-1">
                        {fmt(new Date(msg.timestamp))}
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
                          {fmt(new Date(msg.timestamp))}
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
                  <div className="pl-5 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 md:px-6 pb-4 pt-2">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 glass rounded-2xl px-4 py-2 shadow-sm"
            >
              <input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about your calendar, emails, or schedule a meeting..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1"
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  message.trim() && !sending
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground/40",
                )}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
