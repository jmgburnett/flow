"use client";

import { Circle, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCapture } from "@/components/providers/capture-provider";

function formatDuration(ms: number) {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ─── Capture Bar (used on dashboard sidebar) ───

export function LiveCaptureBar() {
	const { isRecording, isPaused, elapsed, sessionId, error, start, pause, resume, stop } =
		useCapture();

	const sessionStats = useQuery(
		api.capture.getSessionStats,
		sessionId ? { sessionId } : "skip",
	);

	if (!isRecording) {
		return (
			<div className="flex flex-col items-center gap-2">
				<button
					type="button"
					onClick={start}
					className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all active:scale-[0.97]"
				>
					<Circle className="h-3.5 w-3.5 fill-red-500" />
					<span className="text-sm font-medium">Start Capture</span>
				</button>
				{error && (
					<p className="text-xs text-destructive text-center max-w-[250px]">{error}</p>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-3 px-4 py-2.5 glass-card rounded-2xl">
				{/* Pulsing red dot */}
				<div className="relative flex items-center justify-center">
					{!isPaused && (
						<div className="absolute w-3 h-3 rounded-full bg-red-500/50 animate-ping" />
					)}
					<div
						className={cn(
							"w-2.5 h-2.5 rounded-full",
							isPaused ? "bg-yellow-500" : "bg-red-500",
						)}
					/>
				</div>

				<span className="text-sm font-mono font-medium tabular-nums min-w-[60px]">
					{formatDuration(elapsed)}
				</span>

				<span className="text-xs text-muted-foreground">
					{isPaused ? "Paused" : "Recording"}
					{sessionStats && sessionStats.transcribed > 0 && (
						<span className="ml-1.5 text-primary">
							· {sessionStats.transcribed} transcribed
						</span>
					)}
				</span>

				<div className="flex-1" />

				<div className="flex items-center gap-1">
					{isPaused ? (
						<button type="button" onClick={resume} className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground" title="Resume">
							<Play className="h-4 w-4" />
						</button>
					) : (
						<button type="button" onClick={pause} className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground" title="Pause">
							<Pause className="h-4 w-4" />
						</button>
					)}
					<button type="button" onClick={stop} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-red-500" title="Stop">
						<Square className="h-4 w-4" />
					</button>
				</div>
			</div>

			{error && <p className="text-xs text-destructive px-2">{error}</p>}
		</div>
	);
}

// ─── Global Recording Indicator (shows on all pages when recording) ───

export function GlobalCaptureIndicator() {
	const { isRecording, isPaused, elapsed, stop, pause, resume } = useCapture();

	if (!isRecording) return null;

	return (
		<div className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-1.5 glass-heavy rounded-full shadow-lg">
			<div className="relative flex items-center justify-center">
				{!isPaused && (
					<div className="absolute w-2.5 h-2.5 rounded-full bg-red-500/50 animate-ping" />
				)}
				<div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-yellow-500" : "bg-red-500")} />
			</div>
			<span className="text-xs font-mono font-medium tabular-nums">
				{formatDuration(elapsed)}
			</span>
			{isPaused ? (
				<button type="button" onClick={resume} className="p-1 rounded-lg hover:bg-accent transition-colors" title="Resume">
					<Play className="h-3 w-3" />
				</button>
			) : (
				<button type="button" onClick={pause} className="p-1 rounded-lg hover:bg-accent transition-colors" title="Pause">
					<Pause className="h-3 w-3" />
				</button>
			)}
			<button type="button" onClick={stop} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors text-red-500" title="Stop">
				<Square className="h-3 w-3" />
			</button>
		</div>
	);
}

// ─── Transcript Viewer ───

export function TranscriptViewer({ sessionId }: { sessionId: Id<"capture_sessions"> }) {
	const transcript = useQuery(api.capture.getSessionTranscript, { sessionId });

	if (!transcript || transcript.length === 0) {
		return (
			<div className="text-xs text-muted-foreground text-center py-4">
				Waiting for audio...
			</div>
		);
	}

	return (
		<div className="space-y-2 max-h-[300px] overflow-y-auto px-1">
			{transcript.map((chunk) => (
				<div key={chunk.chunkIndex} className="text-xs">
					{chunk.status === "transcribing" && (
						<p className="text-muted-foreground italic">Transcribing chunk {chunk.chunkIndex + 1}...</p>
					)}
					{chunk.status === "transcribed" && chunk.transcript && (
						<div className="space-y-1">
							{chunk.transcript.split("\n").map((line, i) => {
								const speakerMatch = line.match(/^\[Speaker (\d+)\]: (.+)/);
								if (speakerMatch) {
									return (
										<p key={i}>
											<span className="font-medium text-primary">
												Speaker {Number.parseInt(speakerMatch[1]) + 1}:
											</span>{" "}
											<span className="text-foreground">{speakerMatch[2]}</span>
										</p>
									);
								}
								return <p key={i} className="text-foreground">{line}</p>;
							})}
						</div>
					)}
					{chunk.status === "error" && (
						<p className="text-destructive">Error processing chunk {chunk.chunkIndex + 1}</p>
					)}
				</div>
			))}
		</div>
	);
}
