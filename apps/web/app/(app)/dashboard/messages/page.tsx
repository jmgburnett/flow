"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Format phone number for display
function formatPhoneNumber(phone: string): string {
	const cleaned = phone.replace(/\D/g, "");
	if (cleaned.length === 11 && cleaned.startsWith("1")) {
		const areaCode = cleaned.slice(1, 4);
		const prefix = cleaned.slice(4, 7);
		const line = cleaned.slice(7, 11);
		return `(${areaCode}) ${prefix}-${line}`;
	}
	return phone;
}

// Format timestamp for display
function formatTimestamp(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = diff / (1000 * 60);
	const hours = diff / (1000 * 60 * 60);
	const days = diff / (1000 * 60 * 60 * 24);

	if (minutes < 60) {
		return `${Math.floor(minutes)}m ago`;
	}
	if (hours < 24) {
		return `${Math.floor(hours)}h ago`;
	}
	if (days < 2) {
		return "Yesterday";
	}
	if (days < 7) {
		return `${Math.floor(days)}d ago`;
	}
	return new Date(timestamp).toLocaleDateString();
}

export default function MessagesPage() {
	const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
	const [messageInput, setMessageInput] = useState("");

	// Fetch conversations and messages from Convex
	const conversations = useQuery(api.sms.listConversations, {
		userId: "josh",
	});

	const messages = useQuery(
		api.sms.getMessages,
		selectedPhone ? { userId: "josh", phoneNumber: selectedPhone } : "skip",
	);

	const sendMessage = useMutation(api.sms.sendMessage);
	const markRead = useMutation(api.sms.markRead);

	const selectedConversation = conversations?.find(
		(c) => c.phoneNumber === selectedPhone,
	);

	const handleSelectConversation = async (phone: string) => {
		setSelectedPhone(phone);
		// Mark as read when opening conversation
		await markRead({
			userId: "josh",
			phoneNumber: phone,
		});
	};

	const handleSendMessage = async () => {
		if (!messageInput.trim() || !selectedPhone) return;

		await sendMessage({
			userId: "josh",
			from: "+16156408799", // Josh's Telnyx number
			to: selectedPhone,
			body: messageInput,
			contactName: selectedConversation?.contactName,
		});

		setMessageInput("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<DashboardLayout>
			<div className="flex h-full flex-col md:flex-row">
				{/* Conversation List */}
				<div
					className={cn(
						"w-full border-b md:w-[380px] md:border-r md:border-b-0",
						selectedPhone && "hidden md:block",
					)}
				>
					<div className="border-b p-4">
						<h1 className="text-lg font-bold md:text-xl">Messages</h1>
					</div>
					<div className="overflow-auto h-[calc(100vh-10rem)] md:h-[calc(100vh-7rem)]">
						{conversations && conversations.length === 0 && (
							<div className="flex items-center justify-center h-full p-8 text-center">
								<p className="text-muted-foreground">No messages yet</p>
							</div>
						)}
						{conversations?.map((conversation) => (
							<div
								key={conversation._id}
								onClick={() => handleSelectConversation(conversation.phoneNumber)}
								className={cn(
									"flex items-start gap-3 border-b p-4 cursor-pointer transition-colors active:bg-accent",
									"hover:bg-accent/50",
									selectedPhone === conversation.phoneNumber && "bg-accent",
								)}
							>
								<Avatar className="h-12 w-12 flex-shrink-0">
									<AvatarFallback className="bg-blue-600 text-white">
										{conversation.contactName?.[0] || "?"}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between mb-1">
										<p className="font-semibold text-sm truncate">
											{conversation.contactName || formatPhoneNumber(conversation.phoneNumber)}
										</p>
										<span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
											{formatTimestamp(conversation.lastMessageAt)}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<p className="text-sm text-muted-foreground truncate">
											{conversation.lastMessage}
										</p>
										{conversation.unreadCount > 0 && (
											<Badge
												variant="destructive"
												className="ml-2 h-5 w-5 flex-shrink-0 rounded-full p-0 flex items-center justify-center text-[10px]"
											>
												{conversation.unreadCount}
											</Badge>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Conversation View */}
				{selectedPhone ? (
					<div className="flex flex-1 flex-col">
						{/* Header */}
						<div className="flex items-center gap-3 border-b p-4">
							<Button
								variant="ghost"
								size="icon"
								className="md:hidden"
								onClick={() => setSelectedPhone(null)}
							>
								<ArrowLeft className="h-5 w-5" />
							</Button>
							<Avatar className="h-10 w-10">
								<AvatarFallback className="bg-blue-600 text-white">
									{selectedConversation?.contactName?.[0] || "?"}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<p className="font-semibold">
									{selectedConversation?.contactName || formatPhoneNumber(selectedPhone)}
								</p>
								{selectedConversation?.contactName && (
									<p className="text-xs text-muted-foreground">
										{formatPhoneNumber(selectedPhone)}
									</p>
								)}
							</div>
						</div>

						{/* Messages */}
						<div className="flex-1 overflow-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/20">
							{messages?.map((message) => {
								const isOutbound = message.direction === "outbound";
								return (
									<div
										key={message._id}
										className={cn(
											"flex",
											isOutbound ? "justify-end" : "justify-start",
										)}
									>
										<div
											className={cn(
												"max-w-[80%] rounded-2xl px-4 py-2",
												isOutbound
													? "bg-blue-600 text-white"
													: "bg-white dark:bg-slate-800 text-foreground",
											)}
										>
											<p className="text-sm whitespace-pre-wrap break-words">
												{message.body}
											</p>
											<p
												className={cn(
													"text-[10px] mt-1",
													isOutbound ? "text-blue-100" : "text-muted-foreground",
												)}
											>
												{new Date(message.timestamp).toLocaleTimeString("en-US", {
													hour: "numeric",
													minute: "2-digit",
												})}
											</p>
										</div>
									</div>
								);
							})}
						</div>

						{/* Input Bar */}
						<div className="border-t p-4 bg-background">
							<div className="flex items-end gap-2">
								<Input
									placeholder="Type a message..."
									value={messageInput}
									onChange={(e) => setMessageInput(e.target.value)}
									onKeyDown={handleKeyPress}
									className="flex-1 min-h-[44px] resize-none"
								/>
								<Button
									size="icon"
									className="h-11 w-11 flex-shrink-0"
									onClick={handleSendMessage}
									disabled={!messageInput.trim()}
								>
									<Send className="h-5 w-5" />
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
						Select a conversation to view messages
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}
