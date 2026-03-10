"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatInterface } from "@/components/chat-interface";
import {
	Home,
	Inbox,
	Calendar,
	MessageCircle,
	MoreHorizontal,
} from "lucide-react";

interface DashboardLayoutProps {
	children: React.ReactNode;
	user?: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
}

const navigation = [
	{ name: "Home", href: "/dashboard", icon: Home },
	{ name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
	{ name: "Messages", href: "/dashboard/messages", icon: MessageCircle },
	{ name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
	{ name: "More", href: "/dashboard/more", icon: MoreHorizontal },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
	const pathname = usePathname();
	const displayName = user?.name || user?.email || "User";
	const avatarUrl = user?.image || undefined;
	const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return "Good morning";
		if (hour < 18) return "Good afternoon";
		return "Good evening";
	};

	return (
		<div className="h-screen overflow-hidden bg-background">
			{/* Desktop sidebar — fixed left */}
			<aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:w-20 md:flex-col md:border-r md:bg-slate-950">
				<div className="flex h-14 items-center justify-center border-b border-slate-800">
					<span className="text-xl font-bold text-blue-400">F</span>
				</div>
				<nav className="flex flex-1 flex-col items-center gap-2 py-4">
					{navigation.map((item) => {
						const Icon = item.icon;
						const isActive = pathname === item.href ||
							(item.href !== "/dashboard" && pathname?.startsWith(item.href));
						return (
							<Link
								key={item.name}
								href={item.href}
								className={cn(
									"flex h-12 w-12 items-center justify-center rounded-lg transition-colors group relative",
									isActive
										? "bg-blue-600 text-white"
										: "text-slate-400 hover:bg-slate-800 hover:text-white",
								)}
								title={item.name}
							>
								<Icon className="h-5 w-5" />
								<span className="absolute left-full ml-2 px-2 py-1 rounded bg-slate-800 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
									{item.name}
								</span>
							</Link>
						);
					})}
				</nav>
			</aside>

			{/* Main content area — offset on desktop */}
			<div className="flex flex-col h-full md:ml-20">
				{/* Top bar */}
				<header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
					<h1 className="text-lg font-semibold md:text-xl truncate">
						{getGreeting()}, {user?.name || "Josh"}
					</h1>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="relative h-9 w-9 rounded-full shrink-0">
								<Avatar className="h-9 w-9">
									<AvatarImage src={avatarUrl} />
									<AvatarFallback>{initials}</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium">{displayName}</p>
									<p className="text-xs text-muted-foreground">{user?.email}</p>
								</div>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/dashboard/settings">Settings</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>

				{/* Scrollable page content */}
				<main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-6">
					{children}
				</main>
			</div>

			{/* Mobile bottom nav — pill style */}
			<nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
				<div className="mx-4 mb-4 rounded-full border bg-background/95 backdrop-blur-lg shadow-lg">
					<div className="flex items-center justify-around px-2 py-2">
						{navigation.map((item) => {
							const Icon = item.icon;
							const isActive = pathname === item.href ||
								(item.href !== "/dashboard" && pathname?.startsWith(item.href));
							return (
								<Link
									key={item.name}
									href={item.href}
									className={cn(
										"flex flex-col items-center gap-1 rounded-full px-4 py-2 transition-all min-w-[56px]",
										isActive ? "bg-blue-600 text-white" : "text-muted-foreground",
									)}
								>
									<Icon className={cn("h-5 w-5", isActive ? "fill-current" : "")} />
									{isActive && <span className="text-[10px] font-medium">{item.name}</span>}
								</Link>
							);
						})}
					</div>
				</div>
			</nav>

			<ChatInterface />
		</div>
	);
}
