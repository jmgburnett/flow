"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Send, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ChatInterface() {
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<
		Array<{ role: "user" | "assistant"; content: string; time: string }>
	>([
		{
			role: "assistant",
			content:
				"Hi Josh! I'm Flobot, your AI Chief of Staff. How can I help you today?",
			time: formatTime(new Date()),
		},
	]);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	function formatTime(date: Date) {
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		});
	}

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = async () => {
		if (!message.trim()) return;
		const userMessage = message;
		setMessages((prev) => [
			...prev,
			{ role: "user", content: userMessage, time: formatTime(new Date()) },
		]);
		setMessage("");

		// TODO: Call Convex chat action
		setTimeout(() => {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content:
						"I'm here to help! Chat integration coming soon with the Convex backend.",
					time: formatTime(new Date()),
				},
			]);
		}, 500);
	};

	if (!isOpen) {
		return (
			<button
				type="button"
				onClick={() => setIsOpen(true)}
				className="fixed bottom-24 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all active:scale-95 z-50"
			>
				<MessageSquare className="h-5 w-5" />
			</button>
		);
	}

	return (
		<div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] bg-background md:border md:border-border md:rounded-2xl md:shadow-xl flex flex-col z-50">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card md:rounded-t-2xl">
				<div className="flex items-center gap-3">
					<Avatar className="h-8 w-8">
						<AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
							F
						</AvatarFallback>
					</Avatar>
					<div>
						<p className="text-sm font-semibold text-foreground">
							Flobot
						</p>
						<p className="text-xs text-muted-foreground">
							AI Chief of Staff
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setIsOpen(false)}
					className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			{/* Messages — Gloo chat style */}
			<div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-background">
				{messages.map((msg, i) => (
					<div key={i}>
						{msg.role === "user" ? (
							/* User message — right-aligned warm cream bubble */
							<div className="flex flex-col items-end">
								<div className="flex items-center gap-2 mb-1">
									<span className="text-xs text-muted-foreground">
										{msg.time}
									</span>
									<span className="text-xs font-medium text-foreground">
										Josh
									</span>
									<Avatar className="h-5 w-5">
										<AvatarFallback className="text-[10px] bg-muted">
											J
										</AvatarFallback>
									</Avatar>
								</div>
								<div className="max-w-[80%] rounded-2xl rounded-tr-md px-4 py-2.5 bg-[color:var(--chat-user-bubble)] text-[color:var(--chat-user-text)]">
									<p className="text-sm leading-relaxed">
										{msg.content}
									</p>
								</div>
							</div>
						) : (
							/* AI message — left-aligned, no bubble (Gloo style) */
							<div className="flex flex-col items-start">
								<div className="flex items-center gap-2 mb-1">
									<Avatar className="h-5 w-5">
										<AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
											F
										</AvatarFallback>
									</Avatar>
									<span className="text-xs font-medium text-foreground">
										Flobot
									</span>
									<span className="text-xs text-muted-foreground">
										{msg.time}
									</span>
								</div>
								<div className="max-w-[90%] pl-7">
									<p className="text-sm leading-relaxed text-foreground">
										{msg.content}
									</p>
								</div>
							</div>
						)}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>

			{/* Input — Gloo style bar */}
			<div className="px-4 pb-4 pt-2 border-t border-border bg-card md:rounded-b-2xl">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSend();
					}}
					className="flex items-center gap-2"
				>
					<button
						type="button"
						className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
					>
						<Plus className="h-4 w-4" />
					</button>
					<input
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Ask me anything..."
						className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-2"
					/>
					<button
						type="submit"
						disabled={!message.trim()}
						className={cn(
							"p-2 rounded-lg transition-colors",
							message.trim()
								? "bg-primary text-primary-foreground hover:bg-primary/90"
								: "text-muted-foreground",
						)}
					>
						<Send className="h-4 w-4" />
					</button>
				</form>
			</div>
		</div>
	);
}
