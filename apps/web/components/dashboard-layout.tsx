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
	Settings,
	Search,
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

// Desktop sidebar nav (text-based, Gloo style)
const sidebarNav = [
	{ name: "Home", href: "/dashboard" },
	{ name: "Inbox", href: "/dashboard/inbox" },
	{ name: "Messages", href: "/dashboard/messages" },
	{ name: "Calendar", href: "/dashboard/calendar" },
	{ name: "Memory", href: "/dashboard/memory" },
	{ name: "People", href: "/dashboard/people" },
	{ name: "Tasks", href: "/dashboard/tasks" },
	{ name: "Recordings", href: "/dashboard/recordings" },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
	const pathname = usePathname();
	const displayName = user?.name || user?.email || "User";
	const avatarUrl = user?.image || undefined;
	const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

	return (
		<div className="h-screen overflow-hidden bg-background">
			{/* Desktop sidebar — Gloo style */}
			<aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-sidebar">
				{/* Brand */}
				<div className="flex h-14 items-center gap-2.5 px-5 border-b border-border">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
						<span className="text-sm font-bold text-primary-foreground">F</span>
					</div>
					<span className="text-[15px] font-semibold text-foreground">Flow</span>
				</div>

				{/* Search */}
				<div className="px-3 pt-3 pb-1">
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
					>
						<Search className="h-4 w-4" />
						<span>Search</span>
					</button>
				</div>

				{/* Nav */}
				<nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
					{sidebarNav.map((item) => {
						const isActive =
							pathname === item.href ||
							(item.href !== "/dashboard" && pathname?.startsWith(item.href));
						return (
							<Link
								key={item.name}
								href={item.href}
								className={cn(
									"flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
									isActive
										? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
										: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
							>
								{isActive && (
									<div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
								)}
								<span className={cn(!isActive && "ml-3.5")}>{item.name}</span>
							</Link>
						);
					})}
				</nav>

				{/* Bottom: user + settings */}
				<div className="border-t border-border p-3 space-y-1">
					<Link
						href="/dashboard/settings"
						className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
					>
						<Settings className="h-4 w-4" />
						<span>Settings</span>
					</Link>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
							>
								<Avatar className="h-7 w-7">
									<AvatarImage src={avatarUrl} />
									<AvatarFallback className="text-xs bg-muted">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 text-left min-w-0">
									<p className="text-sm font-medium truncate">{displayName}</p>
								</div>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" side="top" className="w-56">
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
				</div>
			</aside>

			{/* Main content area */}
			<div className="flex flex-col h-full md:ml-60">
				{/* Mobile top bar */}
				<header className="flex md:hidden h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
					<div className="flex items-center gap-2">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
							<span className="text-sm font-bold text-primary-foreground">F</span>
						</div>
						<span className="text-[15px] font-semibold">Flow</span>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="relative h-8 w-8 rounded-full">
								<Avatar className="h-8 w-8">
									<AvatarImage src={avatarUrl} />
									<AvatarFallback className="text-xs">{initials}</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>
								<p className="text-sm font-medium">{displayName}</p>
								<p className="text-xs text-muted-foreground">{user?.email}</p>
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
				<div className="mx-4 mb-4 rounded-2xl border border-border bg-card/95 backdrop-blur-lg shadow-lg">
					<div className="flex items-center justify-around px-2 py-2">
						{navigation.map((item) => {
							const Icon = item.icon;
							const isActive =
								pathname === item.href ||
								(item.href !== "/dashboard" && pathname?.startsWith(item.href));
							return (
								<Link
									key={item.name}
									href={item.href}
									className={cn(
										"flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all min-w-[56px]",
										isActive
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground",
									)}
								>
									<Icon className={cn("h-5 w-5", isActive && "fill-current")} />
									{isActive && (
										<span className="text-[10px] font-medium">{item.name}</span>
									)}
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
