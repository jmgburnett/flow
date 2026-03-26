"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCapture } from "@/components/providers/capture-provider";
import { cn } from "@/lib/utils";
import { Mic, MicOff } from "lucide-react";

function formatTime(ms: number) {
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

// Color map for speaker labels
const SPEAKER_COLORS: Record<string, string> = {
	A: "text-[#08a39e]",
	B: "text-blue-500",
	C: "text-purple-500",
	D: "text-orange-500",
	E: "text-pink-500",
};

function speakerColor(speaker: string | undefined) {
	if (!speaker) return "text-foreground";
	const key = speaker.toUpperCase().replace("SPEAKER_", "");
	return SPEAKER_COLORS[key] ?? "text-foreground";
}

function speakerLabel(speaker: string | undefined) {
	if (!speaker) return null;
	const key = speaker.toUpperCase().replace("SPEAKER_", "");
	return `Speaker ${key}`;
}

export function LiveTranscriptPanel({ sessionId }: { sessionId: Id<"capture_sessions"> }) {
	const { partialTranscript, isRecording, isPaused } = useCapture();
	const segments = useQuery(api.capture.getTranscriptSegments, { sessionId });
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when segments or partial transcript changes
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [segments?.length, partialTranscript]);

	if (!segments || segments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
				{isRecording && !isPaused ? (
					<>
						<div className="relative flex items-center justify-center">
							<div className="absolute w-8 h-8 rounded-full bg-[#08a39e]/20 animate-ping" />
							<div className="w-5 h-5 rounded-full bg-[#08a39e]/60 animate-pulse" />
						</div>
						<p className="text-sm text-muted-foreground">Listening for speech...</p>
					</>
				) : isPaused ? (
					<>
						<MicOff className="h-8 w-8 text-muted-foreground/40" />
						<p className="text-sm text-muted-foreground">Recording paused</p>
					</>
				) : (
					<>
						<Mic className="h-8 w-8 text-muted-foreground/30" />
						<p className="text-sm text-muted-foreground">Start recording to see live transcript</p>
					</>
				)}
				{partialTranscript && (
					<p className="text-sm italic text-muted-foreground/70 max-w-xs">
						{partialTranscript}
					</p>
				)}
			</div>
		);
	}

	// Group consecutive segments by speaker
	const grouped: Array<{
		speaker: string | undefined;
		segments: typeof segments;
	}> = [];

	for (const seg of segments) {
		const last = grouped[grouped.length - 1];
		if (last && last.speaker === seg.speaker) {
			last.segments.push(seg);
		} else {
			grouped.push({ speaker: seg.speaker, segments: [seg] });
		}
	}

	return (
		<div ref={scrollRef} className="h-full overflow-y-auto px-4 py-3 space-y-4">
			{grouped.map((group, gi) => {
				const firstSeg = group.segments[0];
				const label = speakerLabel(group.speaker);
				const color = speakerColor(group.speaker);

				return (
					<div key={gi} className="flex gap-3">
						{/* Timestamp gutter */}
						<div className="w-12 shrink-0 text-right pt-0.5">
							<span className="text-[10px] text-muted-foreground font-mono tabular-nums">
								{formatTime(firstSeg.startMs)}
							</span>
						</div>

						{/* Content */}
						<div className="flex-1 min-w-0">
							{label && (
								<p className={cn("text-[11px] font-semibold mb-0.5 uppercase tracking-wide", color)}>
									{label}
								</p>
							)}
							<p className="text-sm leading-relaxed text-foreground">
								{group.segments.map((s) => s.text).join(" ")}
							</p>
						</div>
					</div>
				);
			})}

			{/* Partial transcript (streaming) */}
			{partialTranscript && (
				<div className="flex gap-3">
					<div className="w-12 shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-sm leading-relaxed text-muted-foreground/70 italic">
							{partialTranscript}
							<span className="inline-block w-1 h-3.5 ml-0.5 bg-[#08a39e]/60 animate-pulse align-text-bottom rounded-sm" />
						</p>
					</div>
				</div>
			)}

			{/* Live indicator */}
			{isRecording && !isPaused && !partialTranscript && (
				<div className="flex gap-3">
					<div className="w-12 shrink-0" />
					<div className="flex items-center gap-1.5">
						<div className="w-1 h-3 bg-[#08a39e]/40 rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
						<div className="w-1 h-4 bg-[#08a39e]/60 rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
						<div className="w-1 h-2 bg-[#08a39e]/40 rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
					</div>
				</div>
			)}

			<div ref={bottomRef} />
		</div>
	);
}
