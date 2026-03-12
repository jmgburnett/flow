"use client";

import {
	createContext,
	useContext,
	useState,
	useRef,
	useCallback,
	useEffect,
	type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const CHUNK_DURATION_MS = 60000; // 60 seconds

interface CaptureState {
	isRecording: boolean;
	isPaused: boolean;
	elapsed: number;
	chunkIndex: number;
	sessionId: Id<"capture_sessions"> | null;
	error: string | null;
	start: () => Promise<void>;
	pause: () => Promise<void>;
	resume: () => Promise<void>;
	stop: () => Promise<void>;
}

const CaptureContext = createContext<CaptureState>({
	isRecording: false,
	isPaused: false,
	elapsed: 0,
	chunkIndex: 0,
	sessionId: null,
	error: null,
	start: async () => {},
	pause: async () => {},
	resume: async () => {},
	stop: async () => {},
});

export function useCapture() {
	return useContext(CaptureContext);
}

export function CaptureProvider({ children }: { children: ReactNode }) {
	const [isRecording, setIsRecording] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [chunkIndex, setChunkIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [sessionId, setSessionId] = useState<Id<"capture_sessions"> | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sessionIdRef = useRef<Id<"capture_sessions"> | null>(null);
	const chunkIndexRef = useRef(0);
	const startTimeRef = useRef(0);
	const chunkStartRef = useRef(0);

	// Convex mutations
	const startSession = useMutation(api.capture.startSession);
	const pauseSessionMut = useMutation(api.capture.pauseSession);
	const resumeSessionMut = useMutation(api.capture.resumeSession);
	const stopSessionMut = useMutation(api.capture.stopSession);
	const generateUploadUrl = useMutation(api.capture.generateUploadUrl);
	const storeChunk = useMutation(api.capture.storeChunk);

	// Upload a recorded chunk
	const uploadChunk = useCallback(
		async (blob: Blob, sid: Id<"capture_sessions">, index: number) => {
			try {
				const uploadUrl = await generateUploadUrl();
				const response = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": blob.type },
					body: blob,
				});

				if (!response.ok) throw new Error("Upload failed");

				const { storageId } = await response.json();
				const durationMs = Date.now() - chunkStartRef.current;
				chunkStartRef.current = Date.now();

				await storeChunk({ sessionId: sid, chunkIndex: index, storageId, durationMs });
			} catch (err) {
				console.error("Chunk upload error:", err);
				setError("Failed to upload audio chunk");
			}
		},
		[generateUploadUrl, storeChunk],
	);

	const start = useCallback(async () => {
		try {
			setError(null);

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
			});
			streamRef.current = stream;

			const sid = await startSession({ userId: "josh" });
			sessionIdRef.current = sid;
			setSessionId(sid);
			chunkIndexRef.current = 0;
			setChunkIndex(0);

			const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
				? "audio/webm;codecs=opus"
				: "audio/webm";

			const recorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = async (event) => {
				if (event.data.size > 0 && sessionIdRef.current) {
					const idx = chunkIndexRef.current;
					chunkIndexRef.current++;
					setChunkIndex((prev) => prev + 1);
					await uploadChunk(event.data, sessionIdRef.current, idx);
				}
			};

			recorder.onerror = () => setError("Recording error occurred");

			chunkStartRef.current = Date.now();
			startTimeRef.current = Date.now();
			recorder.start(CHUNK_DURATION_MS);

			setIsRecording(true);
			setIsPaused(false);
			setElapsed(0);

			timerRef.current = setInterval(() => {
				setElapsed(Date.now() - startTimeRef.current);
			}, 1000);
		} catch (err) {
			if (err instanceof DOMException && err.name === "NotAllowedError") {
				setError("Microphone access denied. Please allow microphone access.");
			} else {
				setError("Failed to start recording");
			}
		}
	}, [startSession, uploadChunk]);

	const pause = useCallback(async () => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.pause();
			setIsPaused(true);
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			if (sessionIdRef.current) {
				await pauseSessionMut({ sessionId: sessionIdRef.current });
			}
		}
	}, [pauseSessionMut]);

	const resume = useCallback(async () => {
		if (mediaRecorderRef.current?.state === "paused") {
			mediaRecorderRef.current.resume();
			setIsPaused(false);
			const resumeStart = Date.now() - elapsed;
			startTimeRef.current = resumeStart;
			timerRef.current = setInterval(() => {
				setElapsed(Date.now() - resumeStart);
			}, 1000);
			if (sessionIdRef.current) {
				await resumeSessionMut({ sessionId: sessionIdRef.current });
			}
		}
	}, [elapsed, resumeSessionMut]);

	const stop = useCallback(async () => {
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
			await stopSessionMut({ sessionId: sessionIdRef.current });
			sessionIdRef.current = null;
		}
		setIsRecording(false);
		setIsPaused(false);
		setElapsed(0);
		setSessionId(null);
		mediaRecorderRef.current = null;
	}, [stopSessionMut]);

	// Cleanup on unmount (app close)
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
		};
	}, []);

	return (
		<CaptureContext.Provider
			value={{
				isRecording,
				isPaused,
				elapsed,
				chunkIndex,
				sessionId,
				error,
				start,
				pause,
				resume,
				stop,
			}}
		>
			{children}
		</CaptureContext.Provider>
	);
}
