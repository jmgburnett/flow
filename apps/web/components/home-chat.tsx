"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// Simple markdown-ish rendering
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
				parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
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

const SUGGESTIONS = [
	"What's my calendar look like today?",
	"Any urgent emails I need to handle?",
	"Schedule a meeting with Doug next week",
	"What did Carey email me about?",
];

export function HomeChat() {
	const [message, setMessage] = useState("");
	const [sending, setSending] = useState(false);
	const endRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const storedMessages = useQuery(api.chat.getMessages, { userId: "josh", limit: 50 });
	const processMessage = useAction(api.chat.processMessage);

	function fmt(d: Date) {
		return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
			await processMessage({ userId: "josh", message: msgText });
		} catch (error) {
			console.error("Chat error:", error);
		} finally {
			setSending(false);
			inputRef.current?.focus();
		}
	};

	const hasMessages = storedMessages && storedMessages.length > 0;

	return (
		<div className="flex flex-col h-full">
			{/* Messages area */}
			<div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
				{!hasMessages ? (
					/* Empty state — centered greeting + suggestions */
					<div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
						<div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
							<Sparkles className="h-6 w-6 text-primary" />
						</div>
						<h2 className="text-xl font-semibold tracking-tight mb-1">
							What can I help with?
						</h2>
						<p className="text-sm text-muted-foreground mb-6">
							I can check your calendar, search emails, schedule meetings, and more.
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
					/* Message list */
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

						{/* Typing indicator */}
						{sending && (
							<div className="flex flex-col items-start">
								<div className="flex items-center gap-1.5 mb-1">
									<Avatar className="h-4 w-4">
										<AvatarFallback className="text-[8px] bg-primary/10 text-primary">
											F
										</AvatarFallback>
									</Avatar>
									<span className="text-[10px] text-muted-foreground">thinking...</span>
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
				)}
			</div>

			{/* Input bar — pinned to bottom */}
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
	);
}
