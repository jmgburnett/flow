"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  ChevronLeft,
  Users,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

// Dept colors for visual coding
const DEPT_COLORS: Record<string, string> = {
  Engineering: "border-l-blue-500",
  Product: "border-l-purple-500",
  Design: "border-l-pink-500",
  Marketing: "border-l-emerald-500",
  Sales: "border-l-amber-500",
  Operations: "border-l-cyan-500",
  Leadership: "border-l-primary",
};

function getDeptColor(dept?: string): string {
  if (!dept) return "border-l-muted-foreground/30";
  return DEPT_COLORS[dept] ?? "border-l-muted-foreground/30";
}

type OrgNode = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  avatarUrl?: string;
  children: OrgNode[];
};

function OrgTreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className={cn(depth > 0 && "ml-6 md:ml-8")}>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          "w-full text-left glass-card rounded-2xl p-3.5 border-l-4 hover:shadow-md active:scale-[0.99] transition-all mb-2",
          getDeptColor(node.department),
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
            {node.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{node.name}</h3>
              {node.department && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {node.department}
                </Badge>
              )}
            </div>
            {node.role && (
              <p className="text-xs text-muted-foreground truncate">
                {node.role}
              </p>
            )}
          </div>
          {hasChildren && (
            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
              <span className="text-[10px]">{node.children.length}</span>
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
      </button>

      {hasChildren && expanded && (
        <div className="space-y-0">
          {node.children.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };
  const userId = "josh";

  const orgChart = useQuery(api.team.getOrgChart, { userId });
  const teamMembers = useQuery(api.team.listTeamMembers, { userId });

  // Derive unique departments for the legend
  const departments = [
    ...new Set(
      teamMembers?.map((m) => m.department).filter(Boolean) as string[],
    ),
  ];

  return (
    <DashboardLayout user={user}>
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/team"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Network className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-display font-bold">Org Chart</h1>
        </div>

        {/* Department legend */}
        {departments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <div
                key={dept}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <div
                  className={cn(
                    "h-2.5 w-0.5 rounded-full",
                    getDeptColor(dept).replace("border-l-", "bg-"),
                  )}
                />
                <span>{dept}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tree */}
        {!orgChart ? (
          <div className="glass-card rounded-2xl p-4 animate-pulse h-24" />
        ) : orgChart.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No org structure yet</p>
            <p className="text-sm mt-1">
              Set reporting relationships on team member profiles to build the
              org chart
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {orgChart.map((root) => (
              <OrgTreeNode key={root.id} node={root} />
            ))}
          </div>
        )}

        {/* Unassigned members info */}
        {orgChart && orgChart.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-4">
            Members without a reporting relationship appear as root nodes
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
