"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	Mic,
	CheckSquare,
	Users,
	Settings,
	Menu,
	X,
	Search,
	MessageSquare,
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
	{ name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
	{ name: "Recordings", href: "/dashboard/recordings", icon: Mic },
	{ name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
	{ name: "People", href: "/dashboard/people", icon: Users },
	{ name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const pathname = usePathname();

	const displayName = user?.name || user?.email || "User";
	const avatarUrl = user?.image || undefined;
	const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

	return (
		<div className="flex h-screen bg-background">
			{/* Sidebar */}
			<aside
				className={cn(
					"flex flex-col border-r bg-slate-950 text-slate-100 transition-all duration-300",
					sidebarOpen ? "w-64" : "w-0 overflow-hidden",
				)}
			>
				<div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
					<h1 className="text-xl font-bold text-blue-400">Flow</h1>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSidebarOpen(false)}
						className="text-slate-400 hover:text-slate-100 hover:bg-slate-800"
					>
						<X className="h-5 w-5" />
					</Button>
				</div>

				<nav className="flex-1 space-y-1 px-2 py-4">
					{navigation.map((item) => {
						const Icon = item.icon;
						const isActive = pathname === item.href;
						return (
							<Link
								key={item.name}
								href={item.href}
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-blue-600 text-white"
										: "text-slate-300 hover:bg-slate-800 hover:text-white",
								)}
							>
								<Icon className="h-5 w-5" />
								{item.name}
							</Link>
						);
					})}
				</nav>

				{/* Flobot avatar at bottom */}
				<div className="border-t border-slate-800 p-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
							<MessageSquare className="h-5 w-5 text-white" />
						</div>
						<div className="flex-1">
							<p className="text-sm font-medium">Flobot</p>
							<p className="text-xs text-slate-400">AI Chief of Staff</p>
						</div>
					</div>
				</div>
			</aside>

			{/* Main content */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Top bar */}
				<header className="flex h-16 items-center gap-4 border-b bg-background px-6">
					{!sidebarOpen && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(true)}
						>
							<Menu className="h-5 w-5" />
						</Button>
					)}

					{/* Search */}
					<div className="flex-1 max-w-2xl">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search emails, tasks, recordings..."
								className="pl-10"
							/>
						</div>
					</div>

					{/* Voice command button */}
					<Button
						variant="outline"
						size="icon"
						className="rounded-full"
					>
						<Mic className="h-5 w-5" />
					</Button>

					{/* User menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="relative h-10 w-10 rounded-full">
								<Avatar className="h-10 w-10">
									<AvatarImage src={avatarUrl} />
									<AvatarFallback>{initials}</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>
								<div className="flex flex-col space-y-1">
									<p className="text-sm font-medium leading-none">{displayName}</p>
									<p className="text-xs leading-none text-muted-foreground">
										{user?.email}
									</p>
								</div>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href="/dashboard/settings">Settings</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link href="/api/auth/sign-out">Sign out</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>

				{/* Page content */}
				<main className="flex-1 overflow-auto">
					{children}
				</main>
			</div>

			{/* Floating chat interface */}
			<ChatInterface />
		</div>
	);
}
