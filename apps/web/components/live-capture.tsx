"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Pause, Play, Square, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const CHUNK_DURATION_MS = 60000; // 60 seconds per chunk

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

export function LiveCaptureBar() {
	const [isRecording, setIsRecording] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [chunkIndex, setChunkIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sessionIdRef = useRef<Id<"capture_sessions"> | null>(null);
	const chunkIndexRef = useRef(0);
	const startTimeRef = useRef(0);
	const chunkStartRef = useRef(0);

	// Convex mutations
	const startSession = useMutation(api.capture.startSession);
	const pauseSession = useMutation(api.capture.pauseSession);
	const resumeSession = useMutation(api.capture.resumeSession);
	const stopSession = useMutation(api.capture.stopSession);
	const generateUploadUrl = useMutation(api.capture.generateUploadUrl);
	const storeChunk = useMutation(api.capture.storeChunk);

	// Active session query
	const activeSession = useQuery(api.capture.getActiveSession, { userId: "josh" });
	const sessionStats = useQuery(
		api.capture.getSessionStats,
		activeSession ? { sessionId: activeSession._id } : "skip",
	);

	// Upload a recorded chunk
	const uploadChunk = useCallback(
		async (blob: Blob, sessionId: Id<"capture_sessions">, index: number) => {
			try {
				const uploadUrl = await generateUploadUrl();

				const response = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": blob.type },
					body: blob,
				});

				if (!response.ok) {
					throw new Error("Upload failed");
				}

				const { storageId } = await response.json();

				const durationMs = Date.now() - chunkStartRef.current;
				chunkStartRef.current = Date.now();

				await storeChunk({
					sessionId,
					chunkIndex: index,
					storageId,
					durationMs,
				});
			} catch (err) {
				console.error("Chunk upload error:", err);
				setError("Failed to upload audio chunk");
			}
		},
		[generateUploadUrl, storeChunk],
	);

	// Start recording
	const handleStart = async () => {
		try {
			setError(null);

			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 48000,
				},
			});
			streamRef.current = stream;

			// Create session in Convex
			const sessionId = await startSession({ userId: "josh" });
			sessionIdRef.current = sessionId;
			chunkIndexRef.current = 0;
			setChunkIndex(0);

			// Set up MediaRecorder
			const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: "audio/webm";

			const recorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = async (event) => {
				if (event.data.size > 0 && sessionIdRef.current) {
					const currentIndex = chunkIndexRef.current;
					chunkIndexRef.current++;
					setChunkIndex((prev) => prev + 1);
					await uploadChunk(event.data, sessionIdRef.current, currentIndex);
				}
			};

			recorder.onerror = (event) => {
				console.error("MediaRecorder error:", event);
				setError("Recording error occurred");
			};

			// Start recording with chunk intervals
			chunkStartRef.current = Date.now();
			startTimeRef.current = Date.now();
			recorder.start(CHUNK_DURATION_MS);

			setIsRecording(true);
			setIsPaused(false);
			setElapsed(0);

			// Start timer
			timerRef.current = setInterval(() => {
				setElapsed(Date.now() - startTimeRef.current);
			}, 1000);
		} catch (err) {
			console.error("Start recording error:", err);
			if (err instanceof DOMException && err.name === "NotAllowedError") {
				setError("Microphone access denied. Please allow microphone access in your browser settings.");
			} else {
				setError("Failed to start recording");
			}
		}
	};

	// Pause recording
	const handlePause = async () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
			mediaRecorderRef.current.pause();
			setIsPaused(true);

			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}

			if (sessionIdRef.current) {
				await pauseSession({ sessionId: sessionIdRef.current });
			}
		}
	};

	// Resume recording
	const handleResume = async () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
			mediaRecorderRef.current.resume();
			setIsPaused(false);

			// Resume timer from current elapsed
			const resumeStart = Date.now() - elapsed;
			startTimeRef.current = resumeStart;
			timerRef.current = setInterval(() => {
				setElapsed(Date.now() - resumeStart);
			}, 1000);

			if (sessionIdRef.current) {
				await resumeSession({ sessionId: sessionIdRef.current });
			}
		}
	};

	// Stop recording
	const handleStop = async () => {
		if (mediaRecorderRef.current) {
			mediaRecorderRef.current.stop();
		}

		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}

		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (sessionIdRef.current) {
			await stopSession({ sessionId: sessionIdRef.current });
			sessionIdRef.current = null;
		}

		setIsRecording(false);
		setIsPaused(false);
		setElapsed(0);
		mediaRecorderRef.current = null;
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
		};
	}, []);

	// Not recording — show start button
	if (!isRecording) {
		return (
			<div className="flex flex-col items-center gap-2">
				<button
					type="button"
					onClick={handleStart}
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

	// Recording — show controls + status
	return (
		<div className="flex flex-col gap-2">
			{/* Recording bar */}
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

				{/* Timer */}
				<span className="text-sm font-mono font-medium tabular-nums min-w-[60px]">
					{formatDuration(elapsed)}
				</span>

				{/* Status text */}
				<span className="text-xs text-muted-foreground">
					{isPaused ? "Paused" : "Recording"}
					{sessionStats && sessionStats.transcribed > 0 && (
						<span className="ml-1.5 text-primary">
							· {sessionStats.transcribed} chunks transcribed
						</span>
					)}
				</span>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Controls */}
				<div className="flex items-center gap-1">
					{isPaused ? (
						<button
							type="button"
							onClick={handleResume}
							className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground"
							title="Resume"
						>
							<Play className="h-4 w-4" />
						</button>
					) : (
						<button
							type="button"
							onClick={handlePause}
							className="p-2 rounded-xl hover:bg-accent transition-colors text-foreground"
							title="Pause"
						>
							<Pause className="h-4 w-4" />
						</button>
					)}
					<button
						type="button"
						onClick={handleStop}
						className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-red-500"
						title="Stop"
					>
						<Square className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* Error */}
			{error && (
				<p className="text-xs text-destructive px-2">{error}</p>
			)}
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
