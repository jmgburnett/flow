"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Search,
  X,
  ChevronLeft,
  MapPin,
  Building2,
  Briefcase,
  Brain,
  Shield,
  Star,
  Edit2,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const LEVEL_COLORS = {
  beginner: "bg-gray-400",
  intermediate: "bg-blue-500",
  advanced: "bg-emerald-500",
  expert: "bg-amber-500",
};

const LEVEL_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export default function TeamMembersPage() {
  const user = { name: "Josh", email: "josh@onflourish.com" };

  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selectedMemberId, setSelectedMemberId] =
    useState<Id<"contacts"> | null>(null);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [formDept, setFormDept] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formJobDesc, setFormJobDesc] = useState("");
  const [formEnneagram, setFormEnneagram] = useState("");
  const [formMbti, setFormMbti] = useState("");
  const [formDisc, setFormDisc] = useState("");
  const [formLeadershipStyle, setFormLeadershipStyle] = useState("");
  const [formWorkingStyle, setFormWorkingStyle] = useState("");

  const teamMembers = useQuery(api.team.listTeamMembers, {});
  const selectedMember = useQuery(
    api.team.getTeamMember,
    selectedMemberId ? { id: selectedMemberId } : "skip",
  );
  const skills = useQuery(api.skills.listSkills, {});
  const updateProfile = useMutation(api.team.updateTeamProfile);

  // Derive unique departments
  const departments = [
    ...new Set(
      teamMembers?.map((m) => m.department).filter(Boolean) as string[],
    ),
  ];

  // Filter
  const filtered = teamMembers?.filter((m) => {
    if (deptFilter !== "all" && m.department !== deptFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      m.company?.toLowerCase().includes(q)
    );
  });

  function openEdit(member: any) {
    setFormDept(member.department ?? "");
    setFormLocation(member.location ?? "");
    setFormJobDesc(member.jobDescription ?? "");
    setFormEnneagram(member.personality?.enneagram ?? "");
    setFormMbti(member.personality?.mbti ?? "");
    setFormDisc(member.personality?.disc ?? "");
    setFormLeadershipStyle(member.personality?.leadershipStyle ?? "");
    setFormWorkingStyle(member.personality?.workingStyle ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!selectedMemberId) return;
    await updateProfile({
      id: selectedMemberId,
      department: formDept || undefined,
      location: formLocation || undefined,
      jobDescription: formJobDesc || undefined,
      personality: {
        enneagram: formEnneagram || undefined,
        mbti: formMbti || undefined,
        disc: formDisc || undefined,
        leadershipStyle: formLeadershipStyle || undefined,
        workingStyle: formWorkingStyle || undefined,
      },
    });
    setEditing(false);
  }

  // ─── Member Detail ───
  if (selectedMemberId && selectedMember) {
    return (
      <DashboardLayout user={user}>
        <div className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedMemberId(null);
              setEditing(false);
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Team Members
          </button>

          {/* Header card */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold shrink-0">
                {selectedMember.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-semibold text-xl tracking-tight">
                  {selectedMember.name}
                </h2>
                {(selectedMember.role || selectedMember.company) && (
                  <p className="text-sm text-muted-foreground">
                    {selectedMember.role}
                    {selectedMember.role && selectedMember.company && " · "}
                    {selectedMember.company}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                  {selectedMember.department && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {selectedMember.department}
                    </span>
                  )}
                  {selectedMember.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedMember.location}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl shrink-0"
                onClick={() => openEdit(selectedMember)}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            </div>

            {/* Reporting */}
            {(selectedMember.managerName ||
              selectedMember.directReportNames?.length > 0) && (
              <div className="pt-2 border-t border-border/50 space-y-1">
                {selectedMember.managerName && (
                  <p className="text-xs text-muted-foreground">
                    Reports to:{" "}
                    <span className="text-foreground font-medium">
                      {selectedMember.managerName}
                    </span>
                  </p>
                )}
                {selectedMember.directReportNames?.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Direct reports:{" "}
                    {selectedMember.directReportNames
                      .map((r: any) => r.name)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Skills */}
          {selectedMember.resolvedSkills?.length > 0 && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold text-sm">Skills</h3>
              </div>
              <div className="space-y-2">
                {selectedMember.resolvedSkills.map((skill: any) => (
                  <div key={skill.skillId} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        LEVEL_COLORS[skill.level as SkillLevel],
                      )}
                    />
                    <span className="text-sm flex-1">{skill.skillName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {LEVEL_LABELS[skill.level as SkillLevel]}
                    </Badge>
                    {skill.isGap && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-500 border-amber-300"
                      >
                        Gap
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personality */}
          {selectedMember.personality &&
            Object.values(selectedMember.personality).some(Boolean) && (
              <div className="glass-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <h3 className="font-display font-semibold text-sm">
                    Personality & Style
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selectedMember.personality.mbti && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        MBTI
                      </p>
                      <p className="text-sm font-medium">
                        {selectedMember.personality.mbti}
                      </p>
                    </div>
                  )}
                  {selectedMember.personality.enneagram && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Enneagram
                      </p>
                      <p className="text-sm font-medium">
                        {selectedMember.personality.enneagram}
                      </p>
                    </div>
                  )}
                  {selectedMember.personality.disc && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        DISC
                      </p>
                      <p className="text-sm font-medium">
                        {selectedMember.personality.disc}
                      </p>
                    </div>
                  )}
                  {selectedMember.personality.leadershipStyle && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Leadership Style
                      </p>
                      <p className="text-sm">
                        {selectedMember.personality.leadershipStyle}
                      </p>
                    </div>
                  )}
                  {selectedMember.personality.workingStyle && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Working Style
                      </p>
                      <p className="text-sm">
                        {selectedMember.personality.workingStyle}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Job description */}
          {selectedMember.jobDescription && (
            <div className="glass-card rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold text-sm">
                  Job Description
                </h3>
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {selectedMember.jobDescription}
              </p>
            </div>
          )}

          {/* Empty state for members with no profile data */}
          {!selectedMember.resolvedSkills?.length &&
            !selectedMember.personality &&
            !selectedMember.department &&
            !selectedMember.jobDescription && (
              <div className="glass-card rounded-2xl p-5 text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No team profile data yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click Edit to add skills, personality, and more
                </p>
              </div>
            )}
        </div>

        {/* Edit dialog */}
        <Dialog
          open={editing}
          onOpenChange={(open) => !open && setEditing(false)}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Team Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Department
                  </label>
                  <Input
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Location
                  </label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Nashville, TN"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Job Description
                </label>
                <Textarea
                  value={formJobDesc}
                  onChange={(e) => setFormJobDesc(e.target.value)}
                  placeholder="Role responsibilities..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">
                  Personality Assessments
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      MBTI
                    </label>
                    <Input
                      value={formMbti}
                      onChange={(e) => setFormMbti(e.target.value)}
                      placeholder="INTJ"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Enneagram
                    </label>
                    <Input
                      value={formEnneagram}
                      onChange={(e) => setFormEnneagram(e.target.value)}
                      placeholder="Type 3w2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      DISC
                    </label>
                    <Input
                      value={formDisc}
                      onChange={(e) => setFormDisc(e.target.value)}
                      placeholder="DI"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Leadership Style
                </label>
                <Input
                  value={formLeadershipStyle}
                  onChange={(e) => setFormLeadershipStyle(e.target.value)}
                  placeholder="e.g. Servant leader, visionary..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Working Style
                </label>
                <Input
                  value={formWorkingStyle}
                  onChange={(e) => setFormWorkingStyle(e.target.value)}
                  placeholder="e.g. Async-first, deep focus mornings..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
  }

  // ─── Members List ───
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
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-display font-bold">Team Members</h1>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered?.length ?? 0} members
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, role, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Department filter */}
        {departments.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              type="button"
              onClick={() => setDeptFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                deptFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass text-foreground hover:bg-accent",
              )}
            >
              All
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDeptFilter(dept)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  deptFilter === dept
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "glass text-foreground hover:bg-accent",
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {/* Members list */}
        <div className="space-y-2">
          {!filtered ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="glass-card rounded-2xl p-4 animate-pulse"
              >
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No team members yet</p>
              <p className="text-sm mt-1">
                Team members are contacts marked as "coworker" or "team member"
              </p>
            </div>
          ) : (
            filtered.map((member) => (
              <button
                key={member._id}
                type="button"
                onClick={() => setSelectedMemberId(member._id)}
                className="w-full text-left"
              >
                <div className="glass-card rounded-2xl p-4 hover:shadow-md active:scale-[0.99] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-sm truncate">
                          {member.name}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] shrink-0",
                            member.type === "team_member"
                              ? "bg-purple-600 text-white"
                              : "bg-green-600 text-white",
                          )}
                        >
                          {member.type === "team_member" ? "Team" : "Coworker"}
                        </Badge>
                      </div>
                      {(member.role || member.department) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.role}
                          {member.role && member.department && " · "}
                          {member.department}
                        </p>
                      )}
                      {/* Skill badges */}
                      {member.skills && member.skills.length > 0 && (
                        <div className="flex gap-1 mt-1.5 overflow-hidden">
                          {member.skills.slice(0, 3).map((s: any) => (
                            <span
                              key={s.skillId}
                              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  LEVEL_COLORS[s.level as SkillLevel],
                                )}
                              />
                              {/* We don't have skill name here without resolving, show count */}
                            </span>
                          ))}
                          <span className="text-[10px] text-muted-foreground">
                            {member.skills.length} skill
                            {member.skills.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {member.location && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                        <MapPin className="h-3 w-3" />
                        {member.location}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
