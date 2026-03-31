"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  Plus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  TrendingUp,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type StatusFilter = "all" | "active" | "completed" | "archived";

const RAG_COLORS = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  not_started: "bg-gray-400",
};

const RAG_LABELS = {
  green: "On Track",
  amber: "At Risk",
  red: "Behind",
  not_started: "Not Started",
};

const KR_STATUS_COLORS = {
  on_track: "text-emerald-500",
  at_risk: "text-amber-500",
  behind: "text-red-500",
  completed: "text-primary",
};

export default function OKRsPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [expandedObj, setExpandedObj] = useState<Set<string>>(new Set());
  const [showCreateObj, setShowCreateObj] = useState(false);
  const [showCreateKR, setShowCreateKR] = useState<Id<"objectives"> | null>(
    null,
  );
  const [editingObj, setEditingObj] = useState<any>(null);
  const [editingKR, setEditingKR] = useState<any>(null);

  // Create objective form
  const [objTitle, setObjTitle] = useState("");
  const [objDesc, setObjDesc] = useState("");
  const [objStart, setObjStart] = useState("");
  const [objEnd, setObjEnd] = useState("");

  // Create KR form
  const [krTitle, setKrTitle] = useState("");
  const [krTarget, setKrTarget] = useState("");
  const [krUnit, setKrUnit] = useState("");
  const [krOwnerName, setKrOwnerName] = useState("");

  const dashboard = useQuery(api.okrs.getOKRDashboard, {});
  const allObjectives = useQuery(api.okrs.listObjectives, {
    status: statusFilter === "all" ? undefined : (statusFilter as any),
  });

  const createObjective = useMutation(api.okrs.createObjective);
  const updateObjective = useMutation(api.okrs.updateObjective);
  const deleteObjective = useMutation(api.okrs.deleteObjective);
  const createKeyResult = useMutation(api.okrs.createKeyResult);
  const updateKeyResult = useMutation(api.okrs.updateKeyResult);
  const deleteKeyResult = useMutation(api.okrs.deleteKeyResult);

  function toggleExpand(id: string) {
    setExpandedObj((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetObjForm() {
    setObjTitle("");
    setObjDesc("");
    setObjStart("");
    setObjEnd("");
  }

  function resetKRForm() {
    setKrTitle("");
    setKrTarget("");
    setKrUnit("");
    setKrOwnerName("");
  }

  async function handleCreateObj() {
    if (!objTitle.trim()) return;
    const start = objStart ? new Date(objStart).getTime() : Date.now();
    const end = objEnd
      ? new Date(objEnd).getTime()
      : Date.now() + 90 * 24 * 60 * 60 * 1000;
    await createObjective({
      title: objTitle,
      description: objDesc || undefined,
      startDate: start,
      endDate: end,
    });
    resetObjForm();
    setShowCreateObj(false);
  }

  async function handleCreateKR() {
    if (!showCreateKR || !krTitle.trim() || !krTarget) return;
    await createKeyResult({
      objectiveId: showCreateKR,
      title: krTitle,
      targetValue: Number(krTarget),
      unit: krUnit || undefined,
      ownerName: krOwnerName || undefined,
    });
    resetKRForm();
    setShowCreateKR(null);
  }

  async function handleUpdateRAG(
    objId: Id<"objectives">,
    rag: "green" | "amber" | "red" | "not_started",
  ) {
    await updateObjective({ id: objId, ragStatus: rag });
  }

  async function handleUpdateKRProgress(
    krId: Id<"key_results">,
    current: number,
  ) {
    await updateKeyResult({ id: krId, currentValue: current });
  }

  async function handleCompleteObj(objId: Id<"objectives">) {
    await updateObjective({ id: objId, status: "completed" });
  }

  async function handleDeleteObj(objId: Id<"objectives">) {
    await deleteObjective({ id: objId });
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "archived", label: "Archived" },
    { key: "all", label: "All" },
  ];

  // Use dashboard data when filter is active, otherwise use allObjectives
  const objectives =
    statusFilter === "active"
      ? dashboard?.objectives
      : allObjectives?.map((obj) => ({
          ...obj,
          keyResults: [] as any[],
          progress: 0,
        }));

  return (
    <DashboardLayout user={user}>
      <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/team"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-display font-bold">OKRs</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateObj(true)}
            className="gap-1 rounded-xl"
          >
            <Plus className="h-4 w-4" /> Objective
          </Button>
        </div>

        {/* Summary stats */}
        {dashboard && (
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-2xl p-3 text-center">
              <div className="text-xl font-bold text-primary">
                {dashboard.overallProgress}%
              </div>
              <div className="text-[10px] text-muted-foreground">Progress</div>
            </div>
            <div className="glass-card rounded-2xl p-3 text-center">
              <div className="text-xl font-bold">{dashboard.activeCount}</div>
              <div className="text-[10px] text-muted-foreground">Active</div>
            </div>
            <div className="glass-card rounded-2xl p-3 text-center">
              <div className="text-xl font-bold text-emerald-500">
                {dashboard.completedCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Completed</div>
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div
          className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass text-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Objectives list */}
        <div className="space-y-3">
          {!objectives ? (
            <div className="glass-card rounded-2xl p-4 animate-pulse h-24" />
          ) : objectives.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No objectives yet</p>
              <p className="text-sm mt-1">
                Create your first objective to get started
              </p>
            </div>
          ) : (
            objectives.map((obj: any) => {
              const isExpanded = expandedObj.has(obj._id);
              const ragColor =
                RAG_COLORS[obj.ragStatus as keyof typeof RAG_COLORS];
              const ragLabel =
                RAG_LABELS[obj.ragStatus as keyof typeof RAG_LABELS];

              return (
                <div
                  key={obj._id}
                  className="glass-card rounded-2xl overflow-hidden"
                >
                  {/* Objective header */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(obj._id)}
                    className="w-full text-left p-4 hover:bg-accent/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full mt-1 shrink-0",
                          ragColor,
                        )}
                        title={ragLabel}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{obj.title}</h3>
                        {obj.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {obj.description}
                          </p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: `${Math.min(obj.progress ?? 0, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {obj.progress ?? 0}%
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50">
                      {/* RAG selector */}
                      <div className="flex items-center gap-2 py-3">
                        <span className="text-xs text-muted-foreground">
                          Status:
                        </span>
                        {(
                          ["green", "amber", "red", "not_started"] as const
                        ).map((rag) => (
                          <button
                            key={rag}
                            type="button"
                            onClick={() => handleUpdateRAG(obj._id, rag)}
                            className={cn(
                              "h-5 w-5 rounded-full border-2 transition-all",
                              RAG_COLORS[rag],
                              obj.ragStatus === rag
                                ? "border-foreground scale-110"
                                : "border-transparent opacity-50 hover:opacity-80",
                            )}
                            title={RAG_LABELS[rag]}
                          />
                        ))}
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-muted-foreground"
                          onClick={() => handleCompleteObj(obj._id)}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-red-500"
                          onClick={() => handleDeleteObj(obj._id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Key Results */}
                      <div className="space-y-2">
                        {(obj.keyResults ?? []).map((kr: any) => {
                          const pct =
                            kr.targetValue > 0
                              ? Math.round(
                                  (kr.currentValue / kr.targetValue) * 100,
                                )
                              : 0;
                          return (
                            <div
                              key={kr._id}
                              className="bg-muted/30 rounded-xl p-3"
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">
                                    {kr.title}
                                  </p>
                                  {kr.ownerName && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Owner: {kr.ownerName}
                                    </p>
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    KR_STATUS_COLORS[
                                      kr.status as keyof typeof KR_STATUS_COLORS
                                    ],
                                  )}
                                >
                                  {kr.currentValue}/{kr.targetValue}
                                  {kr.unit ? ` ${kr.unit}` : ""}
                                </span>
                              </div>
                              {/* Progress bar + quick update */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {pct}%
                                </span>
                                <input
                                  type="number"
                                  value={kr.currentValue}
                                  onChange={(e) =>
                                    handleUpdateKRProgress(
                                      kr._id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-16 h-6 text-xs text-center rounded border bg-background"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500"
                                  onClick={() =>
                                    deleteKeyResult({ id: kr._id })
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Key Result */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 text-xs rounded-xl gap-1 w-full"
                        onClick={() => setShowCreateKR(obj._id)}
                      >
                        <Plus className="h-3 w-3" /> Key Result
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Objective Dialog */}
      <Dialog
        open={showCreateObj}
        onOpenChange={(open) => {
          if (!open) {
            resetObjForm();
            setShowCreateObj(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> New Objective
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                value={objTitle}
                onChange={(e) => setObjTitle(e.target.value)}
                placeholder="e.g. Increase user retention"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Description
              </label>
              <Textarea
                value={objDesc}
                onChange={(e) => setObjDesc(e.target.value)}
                placeholder="What does success look like?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={objStart}
                  onChange={(e) => setObjStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  End Date
                </label>
                <Input
                  type="date"
                  value={objEnd}
                  onChange={(e) => setObjEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetObjForm();
                setShowCreateObj(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateObj} disabled={!objTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Key Result Dialog */}
      <Dialog
        open={showCreateKR !== null}
        onOpenChange={(open) => {
          if (!open) {
            resetKRForm();
            setShowCreateKR(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> New Key Result
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Key Result
              </label>
              <Input
                value={krTitle}
                onChange={(e) => setKrTitle(e.target.value)}
                placeholder="e.g. Achieve 50% monthly active retention"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Target Value
                </label>
                <Input
                  type="number"
                  value={krTarget}
                  onChange={(e) => setKrTarget(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Unit</label>
                <Input
                  value={krUnit}
                  onChange={(e) => setKrUnit(e.target.value)}
                  placeholder="e.g. %, count, $"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Owner Name
              </label>
              <Input
                value={krOwnerName}
                onChange={(e) => setKrOwnerName(e.target.value)}
                placeholder="Who's responsible?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetKRForm();
                setShowCreateKR(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKR}
              disabled={!krTitle.trim() || !krTarget}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
