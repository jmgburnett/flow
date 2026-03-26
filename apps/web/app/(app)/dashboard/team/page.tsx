"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  Users,
  Target,
  Network,
  Zap,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TeamDashboardPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };
  const userId = "josh";

  const skillCoverage = useQuery(api.team.getSkillCoverage, { userId });
  const okrDashboard = useQuery(api.okrs.getOKRDashboard, { userId });
  const actionCounts = useQuery(api.meetingActions.getActionCounts, { userId });
  const teamMembers = useQuery(api.team.listTeamMembers, { userId });

  const teamSize = teamMembers?.length ?? 0;
  const coveragePct = skillCoverage?.coveragePercent ?? 0;
  const activeOKRs = okrDashboard?.activeCount ?? 0;
  const pendingActions = actionCounts?.pending ?? 0;

  const stats = [
    {
      label: "Team Size",
      value: teamSize,
      icon: Users,
      color: "text-primary",
      href: "/dashboard/team/members",
    },
    {
      label: "Skill Coverage",
      value: `${coveragePct}%`,
      icon: BarChart3,
      color: "text-emerald-500",
      href: "/dashboard/team/members",
    },
    {
      label: "Active OKRs",
      value: activeOKRs,
      icon: Target,
      color: "text-amber-500",
      href: "/dashboard/team/okrs",
    },
    {
      label: "Pending Actions",
      value: pendingActions,
      icon: Zap,
      color: pendingActions > 0 ? "text-red-500" : "text-muted-foreground",
      href: "/dashboard/team/actions",
    },
  ];

  const sections = [
    {
      title: "Team Members",
      description: "Directory, skills, and profiles",
      icon: Users,
      href: "/dashboard/team/members",
      color: "bg-primary/10 text-primary",
      stat: `${teamSize} members`,
    },
    {
      title: "OKRs",
      description: "Objectives and key results",
      icon: Target,
      href: "/dashboard/team/okrs",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      stat: okrDashboard
        ? `${okrDashboard.overallProgress}% progress`
        : undefined,
    },
    {
      title: "Org Chart",
      description: "Reporting structure",
      icon: Network,
      href: "/dashboard/team/org-chart",
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      stat: undefined,
    },
    {
      title: "Meeting Actions",
      description: "Extracted action items",
      icon: Zap,
      href: "/dashboard/team/actions",
      color: "bg-red-500/10 text-red-600 dark:text-red-400",
      stat: pendingActions > 0 ? `${pendingActions} pending` : undefined,
    },
  ];

  return (
    <DashboardLayout user={user}>
      <div className="space-y-5 p-4 md:p-6 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-1">
            <Network className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-semibold tracking-tight">
              TeamOS
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Team leadership, skills, OKRs, and meeting intelligence
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <div className="glass-card rounded-2xl p-4 text-center hover:shadow-md active:scale-[0.98] transition-all">
                  <Icon className={cn("h-5 w-5 mx-auto mb-1.5", stat.color)} />
                  <div
                    className={cn(
                      "text-2xl font-bold tracking-tight",
                      stat.color,
                    )}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {stat.label}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* OKR RAG Summary */}
        {okrDashboard && okrDashboard.activeCount > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight">
                OKR Health
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {okrDashboard.overallProgress}% overall
              </span>
            </div>
            <div className="flex gap-3">
              {[
                {
                  label: "On Track",
                  count: okrDashboard.ragBreakdown.green,
                  color: "bg-emerald-500",
                },
                {
                  label: "At Risk",
                  count: okrDashboard.ragBreakdown.amber,
                  color: "bg-amber-500",
                },
                {
                  label: "Behind",
                  count: okrDashboard.ragBreakdown.red,
                  color: "bg-red-500",
                },
                {
                  label: "Not Started",
                  count: okrDashboard.ragBreakdown.not_started,
                  color: "bg-gray-400",
                },
              ]
                .filter((r) => r.count > 0)
                .map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <div className={cn("h-2.5 w-2.5 rounded-full", r.color)} />
                    <span>
                      {r.count} {r.label}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Section cards */}
        <div className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.title} href={section.href}>
                <div className="glass-card rounded-2xl p-4 hover:shadow-md active:scale-[0.99] transition-all">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                        section.color,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">
                          {section.title}
                        </h3>
                        {section.stat && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {section.stat}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pending Actions Alert */}
        {pendingActions > 0 && (
          <Link href="/dashboard/team/actions">
            <div className="glass-card rounded-2xl p-4 border-amber-200 dark:border-amber-800/40">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {pendingActions} action item
                    {pendingActions !== 1 ? "s" : ""} need review
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From meeting transcripts
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        )}
      </div>
    </DashboardLayout>
  );
}
