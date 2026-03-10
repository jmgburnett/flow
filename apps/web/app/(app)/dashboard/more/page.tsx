"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Settings,
	Mic,
	CheckSquare,
	Users,
	Bell,
	Shield,
	Palette,
	LogOut,
	Link as LinkIcon,
	Brain,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MenuOption {
	name: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
	color: string;
}

const menuOptions: MenuOption[] = [
	{
		name: "Memory",
		href: "/dashboard/memory",
		icon: Brain,
		description: "Notes & context",
		color: "bg-cyan-600",
	},
	{
		name: "Settings",
		href: "/dashboard/settings",
		icon: Settings,
		description: "App preferences",
		color: "bg-slate-600",
	},
	{
		name: "Recordings",
		href: "/dashboard/recordings",
		icon: Mic,
		description: "Voice notes",
		color: "bg-red-600",
	},
	{
		name: "Tasks",
		href: "/dashboard/tasks",
		icon: CheckSquare,
		description: "Todo list",
		color: "bg-green-600",
	},
	{
		name: "People",
		href: "/dashboard/people",
		icon: Users,
		description: "Contacts",
		color: "bg-purple-600",
	},
	{
		name: "Notifications",
		href: "/dashboard/notifications",
		icon: Bell,
		description: "Alerts & updates",
		color: "bg-yellow-600",
	},
	{
		name: "Privacy",
		href: "/dashboard/privacy",
		icon: Shield,
		description: "Security settings",
		color: "bg-indigo-600",
	},
	{
		name: "Appearance",
		href: "/dashboard/appearance",
		icon: Palette,
		description: "Theme & display",
		color: "bg-pink-600",
	},
	{
		name: "Connections",
		href: "/dashboard/settings",
		icon: LinkIcon,
		description: "Google & integrations",
		color: "bg-primary",
	},
];

export default function MorePage() {
	const user = { name: "Josh", email: "josh@onflourish.com", image: undefined as string | undefined };
	const displayName = user?.name || user?.email || "User";
	const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

	return (
		<DashboardLayout user={user}>
			<div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
				{/* User Profile Card */}
				<Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-0">
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<Avatar className="h-16 w-16">
								<AvatarImage src={user?.image} />
								<AvatarFallback className="bg-white/20 text-white text-xl">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div>
								<h2 className="text-xl font-bold">{displayName}</h2>
								<p className="text-primary-foreground/80 text-sm">{user?.email}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Menu Grid */}
				<div className="grid grid-cols-2 gap-3 md:gap-4">
					{menuOptions.map((option) => {
						const Icon = option.icon;
						return (
							<Link key={option.name} href={option.href}>
								<Card className="transition-all hover:shadow-md active:scale-95 cursor-pointer h-full">
									<CardContent className="p-4 md:p-6">
										<div
											className={cn(
												"flex h-12 w-12 items-center justify-center rounded-xl mb-3",
												option.color,
											)}
										>
											<Icon className="h-6 w-6 text-white" />
										</div>
										<h3 className="font-semibold text-sm md:text-base mb-1">
											{option.name}
										</h3>
										<p className="text-xs text-muted-foreground">
											{option.description}
										</p>
									</CardContent>
								</Card>
							</Link>
						);
					})}
				</div>

				{/* Sign Out */}
				<Link href="/api/auth/sign-out">
					<Card className="transition-all hover:shadow-md active:scale-95 cursor-pointer bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
						<CardContent className="p-4 flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600">
								<LogOut className="h-5 w-5 text-white" />
							</div>
							<div>
								<h3 className="font-semibold text-sm text-red-600 dark:text-red-400">
									Sign Out
								</h3>
								<p className="text-xs text-red-600/70 dark:text-red-400/70">
									Log out of your account
								</p>
							</div>
						</CardContent>
					</Card>
				</Link>

				{/* Version Info */}
				<div className="text-center text-xs text-muted-foreground pt-4">
					<p>Flow v1.0.0</p>
					<p className="mt-1">Your AI Chief of Staff</p>
				</div>
			</div>
		</DashboardLayout>
	);
}
