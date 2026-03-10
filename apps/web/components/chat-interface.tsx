"use client";

import { useState, useRef, useEffect } from "react";
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
			content: "Hi Josh! I'm Flobot, your AI Chief of Staff. How can I help?",
			time: fmt(new Date()),
		},
	]);
	const endRef = useRef<HTMLDivElement>(null);

	function fmt(d: Date) {
		return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	}

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = async () => {
		if (!message.trim()) return;
		setMessages((p) => [...p, { role: "user", content: message, time: fmt(new Date()) }]);
		setMessage("");
		setTimeout(() => {
			setMessages((p) => [
				...p,
				{ role: "assistant", content: "I'm here to help! Chat backend coming soon.", time: fmt(new Date()) },
			]);
		}, 500);
	};

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
						<AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">F</AvatarFallback>
					</Avatar>
					<div>
						<p className="text-sm font-semibold tracking-tight">Flobot</p>
						<p className="text-[10px] text-muted-foreground">AI Chief of Staff</p>
					</div>
				</div>
				<button type="button" onClick={() => setIsOpen(false)} className="p-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground">
					<X className="h-4 w-4" />
				</button>
			</div>

			{/* Messages */}
			<div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
				{messages.map((msg, i) => (
					<div key={i}>
						{msg.role === "user" ? (
							<div className="flex flex-col items-end">
								<span className="text-[10px] text-muted-foreground mb-1">{msg.time}</span>
								<div className="max-w-[80%] rounded-2xl rounded-tr-lg px-4 py-2.5 bg-primary text-primary-foreground">
									<p className="text-sm leading-relaxed">{msg.content}</p>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-start">
								<div className="flex items-center gap-1.5 mb-1">
									<Avatar className="h-4 w-4">
										<AvatarFallback className="text-[8px] bg-primary/10 text-primary">F</AvatarFallback>
									</Avatar>
									<span className="text-[10px] text-muted-foreground">{msg.time}</span>
								</div>
								<div className="max-w-[85%] pl-5">
									<p className="text-sm leading-relaxed text-foreground">{msg.content}</p>
								</div>
							</div>
						)}
					</div>
				))}
				<div ref={endRef} />
			</div>

			{/* Input */}
			<div className="px-3 pb-3 pt-1 border-t border-border/30">
				<form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
					className="flex items-center gap-1 glass rounded-xl px-2 py-1">
					<button type="button" className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
						<Plus className="h-4 w-4" />
					</button>
					<input
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Message..."
						className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5"
					/>
					<button type="submit" disabled={!message.trim()}
						className={cn("p-1.5 rounded-lg transition-all", message.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground/40")}>
						<Send className="h-3.5 w-3.5" />
					</button>
				</form>
			</div>
		</div>
	);
}
