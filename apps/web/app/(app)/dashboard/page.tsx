"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MessageCircle, CheckSquare, Clock } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

function DashboardContent() {
  const user = { name: "Josh", email: "josh@onflourish.com" };
  const router = useRouter();

  const emails = useQuery(api.google.getEmails, { userId: "josh" }) ?? [];
  const calendarEvents = useQuery(api.google.getCalendarEvents, {
    userId: "josh",
    startTime: Date.now(),
    endTime: Date.now() + 24 * 60 * 60 * 1000,
  }) ?? [];
  const smsConvos = useQuery(api.sms.listConversations, { userId: "josh" }) ?? [];

  const needsMe = emails.filter((e: any) => e.triageStatus === "needs_me");
  const unreadTexts = smsConvos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);

  // Next event
  const nextEvent = calendarEvents[0];

  // Format time
  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-4 p-4 max-w-2xl mx-auto w-full">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-blue-600 text-white border-0">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{needsMe.length}</div>
              <div className="text-[10px] text-blue-100">Needs You</div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-600 text-white border-0">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{calendarEvents.length}</div>
              <div className="text-[10px] text-indigo-100">Events Today</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-600 text-white border-0">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{unreadTexts}</div>
              <div className="text-[10px] text-purple-100">Unread Texts</div>
            </CardContent>
          </Card>
        </div>

        {/* Next Event */}
        {nextEvent && (
          <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium text-blue-100">NEXT UP</span>
              </div>
              <h3 className="text-lg font-bold mb-1 truncate">{nextEvent.title}</h3>
              <p className="text-sm text-blue-100 truncate">
                {fmtTime(nextEvent.startTime)}
                {nextEvent.attendees?.length ? ` · ${nextEvent.attendees.slice(0, 3).join(", ")}` : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Priority Inbox */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                Priority Inbox
              </CardTitle>
              <Link href="/dashboard/inbox">
                <Badge variant="destructive" className="text-xs">{needsMe.length}</Badge>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {needsMe.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up! 🎉</p>
            ) : (
              needsMe.slice(0, 4).map((email: any) => (
                <button
                  key={email._id}
                  type="button"
                  onClick={() => router.push(`/dashboard/inbox?email=${email._id}`)}
                  className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0 min-w-0 w-full text-left hover:bg-muted/50 rounded-md transition-colors -mx-1 px-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm truncate flex-1">{email.from.split("<")[0].trim()}</p>
                      <Badge variant="destructive" className="text-[10px] shrink-0">Needs You</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{email.accountEmail}</p>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Today Calendar */}
        {calendarEvents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calendarEvents.slice(0, 5).map((event: any) => (
                <div key={event._id} className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtTime(event.startTime)} – {fmtTime(event.endTime)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Texts */}
        {smsConvos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-blue-600 shrink-0" />
                Recent Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {smsConvos.slice(0, 3).map((convo: any) => (
                <div key={convo._id} className="flex items-start gap-3 pb-3 last:pb-0 border-b last:border-0 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{convo.contactName || convo.phoneNumber}</p>
                    <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                  </div>
                  {convo.unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">{convo.unreadCount}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
