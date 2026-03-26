"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  RefreshCw,
  Loader2,
  Sun,
  MessageCircle,
  Zap,
  Lightbulb,
  Moon,
  ClipboardList,
  Users,
  Tag,
  CheckSquare,
  Sparkles,
  Calendar,
  Settings2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ───

interface JournalSection {
  type: string;
  title: string;
  content: string;
  timeRange?: { start: string; end: string };
}

interface Journal {
  _id: string;
  date: string;
  title: string;
  summary: string;
  sections: JournalSection[];
  mood?: string;
  keyDecisions: string[];
  actionItems: Array<{ text: string; priority: string }>;
  peopleMetioned: string[];
  themes: string[];
  wordCount: number;
  captureMinutes: number;
  generatedAt: number;
  status: string;
}

// ─── Helpers ───

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLast14Days() {
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = getTodayDate();
  const yesterday = (() => {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    return `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
  })();

  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

const sectionIcons: Record<string, React.ReactNode> = {
  morning_context: <Sun className="h-4 w-4 text-amber-500" />,
  key_conversations: <MessageCircle className="h-4 w-4 text-blue-500" />,
  decisions_made: <Zap className="h-4 w-4 text-purple-500" />,
  insights: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  evening_reflection: <Moon className="h-4 w-4 text-indigo-500" />,
  tomorrow_prep: <ClipboardList className="h-4 w-4 text-[#08a39e]" />,
};

const moodColors: Record<string, string> = {
  focused: "text-blue-500 bg-blue-500/10",
  energized: "text-green-500 bg-green-500/10",
  scattered: "text-orange-500 bg-orange-500/10",
  reflective: "text-indigo-500 bg-indigo-500/10",
  productive: "text-[#08a39e] bg-[#08a39e]/10",
  stressed: "text-red-500 bg-red-500/10",
  calm: "text-sky-500 bg-sky-500/10",
  creative: "text-purple-500 bg-purple-500/10",
};

function getMoodColor(mood?: string) {
  if (!mood) return "text-muted-foreground bg-muted/50";
  const key = mood.toLowerCase().split(" ")[0];
  return moodColors[key] ?? "text-primary bg-primary/10";
}

function priorityColor(p: string) {
  if (p === "high") return "text-red-500";
  if (p === "medium") return "text-amber-500";
  return "text-muted-foreground";
}

// ─── Schedule Modal ───

function ScheduleModal({
  onClose,
  currentTime,
  currentEnabled,
}: {
  onClose: () => void;
  currentTime?: string;
  currentEnabled?: boolean;
}) {
  const [time, setTime] = useState(currentTime ?? "21:00");
  const [enabled, setEnabled] = useState(currentEnabled ?? true);
  const [saved, setSaved] = useState(false);
  const scheduleJournal = useMutation(api.journal.scheduleJournalGeneration);

  async function handleSave() {
    await scheduleJournal({
      userId: "josh",
      journalTime: time,
      journalTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      journalEnabled: enabled,
    });
    setSaved(true);
    setTimeout(onClose, 700);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="glass-heavy rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Journal Schedule</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              When should Flow generate your daily journal?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Generation time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Auto-generate daily</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0",
                enabled ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5",
                  enabled ? "translate-x-4.5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <div className="pt-1 space-y-2">
            <Button onClick={handleSave} className="w-full" size="sm">
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Saved
                </>
              ) : (
                "Save Schedule"
              )}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              I'll trigger it manually
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Strip ───

function CalendarStrip({
  days,
  journals,
  selectedDate,
  onSelect,
}: {
  days: string[];
  journals: Journal[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const journalMap = new Map(journals.map((j) => [j.date, j]));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {days.map((date) => {
        const journal = journalMap.get(date);
        const isSelected = date === selectedDate;
        const isToday = date === getTodayDate();
        const hasJournal = journal?.status === "complete";
        const isGenerating = journal?.status === "generating";

        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[56px] rounded-2xl px-2 py-2.5 transition-all shrink-0",
              isSelected
                ? "bg-primary/10 text-primary"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {formatDayOfWeek(date)}
            </span>
            <span
              className={cn(
                "text-base font-semibold leading-none",
                isToday && !isSelected && "text-primary",
              )}
            >
              {date.split("-")[2]}
            </span>
            <div className="h-1.5 w-1.5 rounded-full">
              {isGenerating ? (
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              ) : hasJournal ? (
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary" : "bg-primary/50",
                  )}
                />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Journal Detail ───

function JournalDetail({
  journal,
  onRegenerate,
  isRegenerating,
}: {
  journal: Journal;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-2xl font-semibold tracking-tight leading-tight"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {journal.title}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="rounded-xl shrink-0 text-muted-foreground gap-1.5 text-xs"
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-2">
          {journal.mood && (
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full",
                getMoodColor(journal.mood),
              )}
            >
              {journal.mood}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {journal.wordCount.toLocaleString()} words
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground">
            {journal.captureMinutes}m captured
          </span>
        </div>

        {/* Summary */}
        <p
          className="text-sm text-muted-foreground leading-relaxed"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {journal.summary}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {journal.sections.map((section, i) => (
          <div key={i} className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/20">
              {sectionIcons[section.type] ?? (
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              )}
              <h3 className="text-sm font-semibold">{section.title}</h3>
            </div>
            <div className="px-5 py-4">
              <p
                className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {section.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* People */}
        {journal.peopleMetioned.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                People
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {journal.peopleMetioned.map((name) => (
                <span
                  key={name}
                  className="text-xs bg-accent px-2 py-0.5 rounded-full"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Themes */}
        {journal.themes.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Themes
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {journal.themes.map((theme) => (
                <span
                  key={theme}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Decisions */}
        {journal.keyDecisions.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Key Decisions
              </span>
            </div>
            <ul className="space-y-1">
              {journal.keyDecisions.map((d, i) => (
                <li
                  key={i}
                  className="text-xs text-foreground/80 flex items-start gap-2"
                >
                  <span className="text-primary mt-0.5">▸</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {journal.actionItems.length > 0 && (
          <div className="glass-card rounded-2xl p-4 space-y-2 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action Items
              </span>
            </div>
            <ul className="space-y-1.5">
              {journal.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium mt-0.5 shrink-0",
                      priorityColor(item.priority),
                    )}
                  >
                    {item.priority === "high"
                      ? "!!!"
                      : item.priority === "medium"
                        ? "!!"
                        : "!"}
                  </span>
                  <span className="text-xs text-foreground/80">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty Day ───

function EmptyDay({
  date,
  onGenerate,
  isGenerating,
}: {
  date: string;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const isToday = date === getTodayDate();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8 py-16">
      <div className="p-4 rounded-2xl bg-amber-500/5">
        <BookOpen className="h-10 w-10 text-amber-500/40" />
      </div>
      <div>
        <p className="text-base font-medium mb-1">
          {isToday ? "No journal yet for today" : "No journal for this day"}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {isToday
            ? "Generate your daily journal from today's capture sessions."
            : "No journal was generated for this date."}
        </p>
      </div>
      {(isToday || true) && (
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="rounded-2xl gap-2"
          size="sm"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? "Generating..." : "Generate Journal"}
        </Button>
      )}
    </div>
  );
}

// ─── Generating State ───

function GeneratingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8 py-16">
      <div className="relative">
        <div className="p-4 rounded-2xl bg-primary/5">
          <BookOpen className="h-10 w-10 text-primary/30" />
        </div>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
      <div>
        <p className="text-base font-medium mb-1">Generating your journal...</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Claude is reading through your captures and writing your daily
          journal. This takes about 15 seconds.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function JournalPage() {
  const today = getTodayDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const days = getLast14Days();

  const journals = (useQuery(api.journal.getJournalList, {
    userId: "josh",
    limit: 30,
  }) ?? []) as Journal[];

  const selectedJournal = useQuery(api.journal.getJournal, {
    userId: "josh",
    date: selectedDate,
  }) as Journal | null | undefined;

  const prefs = useQuery(api.journal.getUserPreferences, { userId: "josh" });

  const generateJournal = useAction(api.journal.generateJournal);

  async function handleGenerate(date: string) {
    setIsGenerating(true);
    try {
      await generateJournal({ userId: "josh", date });
    } catch (e) {
      console.error("Failed to generate journal:", e);
    } finally {
      setIsGenerating(false);
    }
  }

  const isLoading = selectedJournal === undefined;
  const hasJournal = selectedJournal?.status === "complete";
  const isGeneratingServer = selectedJournal?.status === "generating";

  return (
    <>
      <DashboardLayout>
        <div className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
          {/* Left panel: date picker */}
          <div className="w-[220px] shrink-0 flex flex-col border-r border-border/30">
            <div className="px-4 py-4 border-b border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-primary" />
                <h1 className="text-lg font-semibold tracking-tight">
                  Journal
                </h1>
              </div>

              {/* Recent days list */}
              <div className="space-y-0.5">
                {days.map((date) => {
                  const journal = journals.find((j) => j.date === date);
                  const isSelected = date === selectedDate;
                  const isToday = date === getTodayDate();

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition-all group",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-xs font-medium truncate",
                              isSelected
                                ? "text-primary"
                                : isToday
                                  ? "text-foreground"
                                  : "",
                            )}
                          >
                            {formatDateShort(date)}
                          </p>
                          {journal?.status === "complete" && (
                            <p className="text-[10px] truncate text-muted-foreground leading-tight mt-0.5">
                              {journal.title}
                            </p>
                          )}
                        </div>
                        {journal?.status === "complete" ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                        ) : journal?.status === "generating" ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  {formatDate(selectedDate)}
                </h2>
              </div>

              {/* Calendar strip */}
              <div className="hidden lg:block w-[500px]">
                <CalendarStrip
                  days={days}
                  journals={journals}
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                />
              </div>

              <div className="flex items-center gap-2">
                {!hasJournal && !isGeneratingServer && (
                  <Button
                    size="sm"
                    onClick={() => handleGenerate(selectedDate)}
                    disabled={isGenerating}
                    className="rounded-xl gap-1.5 text-xs"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isGenerating ? "Generating..." : "Generate"}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                  title="Journal schedule settings"
                >
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isGeneratingServer || (isGenerating && !hasJournal) ? (
                <GeneratingState />
              ) : hasJournal && selectedJournal ? (
                <JournalDetail
                  journal={selectedJournal}
                  onRegenerate={() => handleGenerate(selectedDate)}
                  isRegenerating={isGenerating}
                />
              ) : (
                <EmptyDay
                  date={selectedDate}
                  onGenerate={() => handleGenerate(selectedDate)}
                  isGenerating={isGenerating}
                />
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          currentTime={prefs?.journalTime}
          currentEnabled={prefs?.journalEnabled}
        />
      )}
    </>
  );
}
