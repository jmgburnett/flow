"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Send,
  Plus,
  Phone,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function formatTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = diff / 60000;
  const hrs = diff / 3600000;
  const days = diff / 86400000;
  if (mins < 60) return `${Math.floor(mins)}m`;
  if (hrs < 24) return `${Math.floor(hrs)}h`;
  if (days < 2) return "Yesterday";
  if (days < 7) return `${Math.floor(days)}d`;
  return new Date(timestamp).toLocaleDateString();
}

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery(api.sms.listConversations, {});
  const messages = useQuery(
    api.sms.getMessages,
    selectedPhone ? { phoneNumber: selectedPhone } : "skip",
  );
  const sendSMS = useAction(api.sms.sendSMS);
  const markRead = useMutation(api.sms.markRead);

  const selectedConvo = conversations?.find(
    (c: any) => c.phoneNumber === selectedPhone,
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelect = async (phone: string) => {
    setSelectedPhone(phone);
    setShowNewMessage(false);
    await markRead({ phoneNumber: phone });
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedPhone) return;
    setIsSending(true);
    try {
      await sendSMS({
        to: selectedPhone,
        body: messageInput,
        contactName: selectedConvo?.contactName,
      });
      setMessageInput("");
    } catch (e: any) {
      console.error("Send failed:", e);
      alert(`Failed to send: ${e.message}`);
    }
    setIsSending(false);
  };

  const handleNewConversation = () => {
    const cleaned = newNumber.replace(/\D/g, "");
    const phone =
      cleaned.length === 10
        ? `+1${cleaned}`
        : cleaned.length === 11
          ? `+${cleaned}`
          : newNumber;
    setSelectedPhone(phone);
    setShowNewMessage(false);
    setNewNumber("");
  };

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col md:flex-row">
        {/* Conversation List */}
        <div
          className={cn(
            "w-full md:w-[340px] md:border-r border-border/40 flex flex-col",
            selectedPhone && "hidden md:flex",
          )}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold tracking-tight">Messages</h1>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-xl h-8 w-8"
              onClick={() => setShowNewMessage(!showNewMessage)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showNewMessage && (
            <div className="px-4 pb-3 flex gap-2">
              <Input
                placeholder="Phone number..."
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNewConversation()}
                className="rounded-xl text-sm h-9"
                autoFocus
              />
              <Button
                size="sm"
                className="rounded-xl"
                onClick={handleNewConversation}
                disabled={!newNumber.trim()}
              >
                Go
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {conversations && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            )}
            {conversations?.map((convo: any) => (
              <button
                type="button"
                key={convo._id}
                onClick={() => handleSelect(convo.phoneNumber)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-left transition-all",
                  "hover:bg-accent/50 active:bg-accent",
                  selectedPhone === convo.phoneNumber && "bg-accent",
                )}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {convo.contactName?.[0]?.toUpperCase() || "#"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium truncate">
                      {convo.contactName ||
                        formatPhoneNumber(convo.phoneNumber)}
                    </p>
                    <span className="text-[11px] text-muted-foreground ml-2 flex-shrink-0">
                      {formatTimestamp(convo.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate pr-2">
                      {convo.lastMessage}
                    </p>
                    {convo.unreadCount > 0 && (
                      <Badge className="h-4 min-w-[16px] rounded-full px-1 text-[10px] bg-primary flex-shrink-0">
                        {convo.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation View */}
        {selectedPhone ? (
          <div className="flex flex-1 flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 glass-heavy border-b border-border/40">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-xl h-8 w-8"
                onClick={() => setSelectedPhone(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {selectedConvo?.contactName?.[0]?.toUpperCase() || "#"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {selectedConvo?.contactName ||
                    formatPhoneNumber(selectedPhone)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatPhoneNumber(selectedPhone)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl h-8 w-8"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-4 py-4 space-y-2">
              {messages?.map((msg: any, i: number) => {
                const isOut = msg.direction === "outbound";
                const prevMsg = messages[i - 1];
                const showTime =
                  !prevMsg || msg.timestamp - prevMsg.timestamp > 300000;

                return (
                  <div key={msg._id}>
                    {showTime && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] text-muted-foreground glass px-2.5 py-0.5 rounded-full">
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex",
                        isOut ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2",
                          isOut
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "glass rounded-bl-md",
                        )}
                      >
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 glass-heavy border-t border-border/40">
              <div className="flex items-end gap-2">
                <Input
                  placeholder="iMessage"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 rounded-2xl border-0 glass h-10 text-sm px-4"
                  disabled={isSending}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full flex-shrink-0"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
