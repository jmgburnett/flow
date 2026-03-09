"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatInterface() {
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
		{
			role: "assistant",
			content: "Hi Josh! I'm Flobot, your AI Chief of Staff. How can I help you today?",
		},
	]);

	const handleSend = async () => {
		if (!message.trim()) return;

		// Add user message
		const userMessage = message;
		setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
		setMessage("");

		// TODO: Call Convex chat action
		// For now, just add a mock response
		setTimeout(() => {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "I'm here to help! (Chat integration coming soon with Convex backend)",
				},
			]);
		}, 500);
	};

	if (!isOpen) {
		return (
			<Button
				onClick={() => setIsOpen(true)}
				className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
				size="icon"
			>
				<MessageSquare className="h-6 w-6" />
			</Button>
		);
	}

	return (
		<div className="fixed bottom-6 right-6 w-96 h-[600px] bg-background border rounded-lg shadow-2xl flex flex-col z-50">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-t-lg">
				<div className="flex items-center gap-2">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
						<MessageSquare className="h-5 w-5" />
					</div>
					<div>
						<p className="font-semibold">Flobot</p>
						<p className="text-xs text-blue-100">AI Chief of Staff</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setIsOpen(false)}
					className="text-white hover:bg-white/20"
				>
					<X className="h-5 w-5" />
				</Button>
			</div>

			{/* Messages */}
			<div className="flex-1 p-4 overflow-auto space-y-4">
				{messages.map((msg, i) => (
					<div
						key={i}
						className={cn(
							"flex",
							msg.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						<div
							className={cn(
								"max-w-[80%] rounded-lg px-4 py-2",
								msg.role === "user"
									? "bg-blue-600 text-white"
									: "bg-muted text-foreground",
							)}
						>
							<p className="text-sm">{msg.content}</p>
						</div>
					</div>
				))}
			</div>

			{/* Input */}
			<div className="p-4 border-t">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSend();
					}}
					className="flex gap-2"
				>
					<Input
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Ask Flobot anything..."
						className="flex-1"
					/>
					<Button type="submit" size="icon">
						<Send className="h-4 w-4" />
					</Button>
				</form>
			</div>
		</div>
	);
}
