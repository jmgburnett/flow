"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
import { GlobalCaptureIndicator } from "@/components/live-capture";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Home,
  Inbox,
  Calendar,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Search,
  Brain,
  Users,
  CheckSquare,
  Mic,
  Network,
  BookOpen,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const mobileNav = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Messages", href: "/dashboard/messages", icon: MessageCircle },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "More", href: "/dashboard/more", icon: MoreHorizontal },
];

const sidebarNav = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Messages", href: "/dashboard/messages", icon: MessageCircle },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Memory", href: "/dashboard/memory", icon: Brain },
  { name: "People", href: "/dashboard/people", icon: Users },
  { name: "Team", href: "/dashboard/team", icon: Network },
  { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { name: "Recordings", href: "/dashboard/recordings", icon: Mic },
  { name: "Journal", href: "/dashboard/journal", icon: BookOpen },
];

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const pathname = usePathname();
  const displayName = user?.name || user?.email || "User";
  const avatarUrl = user?.image || undefined;
  const initials = user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — glass */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:w-[220px] md:flex-col glass-heavy md:rounded-r-2xl">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">F</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            Flow
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
          {sidebarNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 space-y-0.5">
          <div className="flex items-center justify-between px-1">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] hover:bg-accent transition-all"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium truncate">{displayName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              className="w-56 glass-heavy rounded-xl"
            >
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
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col h-full md:ml-[220px]">
        {/* Mobile header — glass */}
        <header className="flex md:hidden h-12 shrink-0 items-center justify-between px-4 glass-heavy">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
              <span className="text-xs font-bold text-primary-foreground">
                F
              </span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              Flow
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="relative" />
            <Avatar className="h-7 w-7">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — frosted glass bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="mx-3 mb-3 rounded-2xl glass-heavy shadow-lg">
          <div className="flex items-center justify-around px-1 py-1.5">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all min-w-[52px]",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      !isActive && "opacity-0",
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <ChatInterface />
      <GlobalCaptureIndicator />
    </div>
  );
}
