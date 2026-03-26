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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ASSEMBLYAI_WS_URL = "wss://api.assemblyai.com/v2/realtime/ws";
const SAMPLE_RATE = 16000;
// Send audio every 250ms
const SEND_INTERVAL_MS = 250;

export interface PartialTranscriptWord {
	text: string;
	start: number;
	end: number;
	confidence: number;
}

export interface LiveTranscriptMessage {
	type: "partial" | "final";
	text: string;
	words: PartialTranscriptWord[];
	audio_start: number;
	audio_end: number;
	speaker?: string;
	created: string;
}

interface CaptureState {
	isRecording: boolean;
	isPaused: boolean;
	elapsed: number;
	sessionId: Id<"capture_sessions"> | null;
	error: string | null;
	partialTranscript: string;
	start: () => Promise<void>;
	pause: () => Promise<void>;
	resume: () => Promise<void>;
	stop: () => Promise<void>;
}

const CaptureContext = createContext<CaptureState>({
	isRecording: false,
	isPaused: false,
	elapsed: 0,
	sessionId: null,
	error: null,
	partialTranscript: "",
	start: async () => {},
	pause: async () => {},
	resume: async () => {},
	stop: async () => {},
});

export function useCapture() {
	return useContext(CaptureContext);
}

// Inline AudioWorklet processor as a blob URL
function createWorkletUrl() {
	const code = `
class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 0;
    // ~250ms of samples at 16kHz = 4000 samples
    this._targetSize = ${Math.floor(SAMPLE_RATE * SEND_INTERVAL_MS / 1000)};
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      // Clamp and convert float32 to int16
      const s = Math.max(-1, Math.min(1, samples[i]));
      const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
      this._buffer.push(int16);
      this._bufferSize++;
    }

    while (this._bufferSize >= this._targetSize) {
      const chunk = this._buffer.splice(0, this._targetSize);
      this._bufferSize -= this._targetSize;
      const int16Array = new Int16Array(chunk);
      this.port.postMessage(int16Array.buffer, [int16Array.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
`;
	const blob = new Blob([code], { type: "application/javascript" });
	return URL.createObjectURL(blob);
}

export function CaptureProvider({ children }: { children: ReactNode }) {
	const [isRecording, setIsRecording] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [sessionId, setSessionId] = useState<Id<"capture_sessions"> | null>(null);
	const [partialTranscript, setPartialTranscript] = useState("");

	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const workletNodeRef = useRef<AudioWorkletNode | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const sessionIdRef = useRef<Id<"capture_sessions"> | null>(null);
	const startTimeRef = useRef(0);
	const pausedElapsedRef = useRef(0);
	const workletUrlRef = useRef<string | null>(null);

	const startSession = useMutation(api.capture.startSession);
	const pauseSessionMut = useMutation(api.capture.pauseSession);
	const resumeSessionMut = useMutation(api.capture.resumeSession);
	const stopSessionMut = useMutation(api.capture.stopSession);
	const storeSegment = useMutation(api.capture.storeTranscriptSegment);

	const connectWebSocket = useCallback(async (sid: Id<"capture_sessions">) => {
		// Get a short-lived token from our API route
		const res = await fetch("/api/capture/token", { method: "POST" });
		if (!res.ok) {
			throw new Error("Failed to get AssemblyAI token");
		}
		const { token } = await res.json();

		const wsUrl = `${ASSEMBLYAI_WS_URL}?sample_rate=${SAMPLE_RATE}&token=${token}`;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			console.log("[Capture] WebSocket connected to AssemblyAI");
		};

		ws.onmessage = async (event: MessageEvent) => {
			let msg: {
				message_type: string;
				text?: string;
				words?: PartialTranscriptWord[];
				audio_start?: number;
				audio_end?: number;
				speaker?: string;
				created?: string;
			};
			try {
				msg = JSON.parse(event.data as string);
			} catch {
				return;
			}

			if (msg.message_type === "PartialTranscript") {
				setPartialTranscript(msg.text ?? "");
			} else if (msg.message_type === "FinalTranscript" && msg.text) {
				setPartialTranscript("");
				if (sessionIdRef.current && msg.text.trim()) {
					await storeSegment({
						sessionId: sessionIdRef.current,
						text: msg.text,
						speaker: msg.speaker,
						startMs: msg.audio_start ?? 0,
						endMs: msg.audio_end ?? 0,
						isFinal: true,
						timestamp: Date.now(),
					});
				}
			} else if (msg.message_type === "SessionBegins") {
				console.log("[Capture] AssemblyAI session started");
			}
		};

		ws.onerror = (e) => {
			console.error("[Capture] WebSocket error", e);
			setError("Transcription connection error");
		};

		ws.onclose = (e) => {
			console.log("[Capture] WebSocket closed", e.code, e.reason);
		};

		return ws;
	}, [storeSegment]);

	const start = useCallback(async () => {
		try {
			setError(null);
			setPartialTranscript("");

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: SAMPLE_RATE,
					channelCount: 1,
				},
			});
			streamRef.current = stream;

			const sid = await startSession({ userId: "josh" });
			sessionIdRef.current = sid;
			setSessionId(sid);

			// Connect WebSocket first
			await connectWebSocket(sid);

			// Set up AudioContext + AudioWorklet
			const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
			audioContextRef.current = audioCtx;

			// Create worklet blob URL
			if (!workletUrlRef.current) {
				workletUrlRef.current = createWorkletUrl();
			}

			await audioCtx.audioWorklet.addModule(workletUrlRef.current);

			const source = audioCtx.createMediaStreamSource(stream);
			const workletNode = new AudioWorkletNode(audioCtx, "pcm16-processor");
			workletNodeRef.current = workletNode;

			workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
				const ws = wsRef.current;
				if (ws?.readyState === WebSocket.OPEN) {
					// AssemblyAI expects base64-encoded PCM16
					const bytes = new Uint8Array(event.data);
					let binary = "";
					for (let i = 0; i < bytes.byteLength; i++) {
						binary += String.fromCharCode(bytes[i]);
					}
					const base64 = btoa(binary);
					ws.send(JSON.stringify({ audio_data: base64 }));
				}
			};

			source.connect(workletNode);
			workletNode.connect(audioCtx.destination);

			startTimeRef.current = Date.now();
			pausedElapsedRef.current = 0;
			setIsRecording(true);
			setIsPaused(false);
			setElapsed(0);

			timerRef.current = setInterval(() => {
				setElapsed(pausedElapsedRef.current + Date.now() - startTimeRef.current);
			}, 1000);
		} catch (err) {
			if (err instanceof DOMException && err.name === "NotAllowedError") {
				setError("Microphone access denied. Please allow microphone access.");
			} else {
				console.error("[Capture] Start error:", err);
				setError("Failed to start recording");
			}
		}
	}, [startSession, connectWebSocket]);

	const pause = useCallback(async () => {
		if (!isRecording || isPaused) return;

		// Suspend audio context (stops sending data)
		if (audioContextRef.current?.state === "running") {
			await audioContextRef.current.suspend();
		}

		pausedElapsedRef.current = elapsed;
		setIsPaused(true);

		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (sessionIdRef.current) {
			await pauseSessionMut({ sessionId: sessionIdRef.current });
		}
	}, [isRecording, isPaused, elapsed, pauseSessionMut]);

	const resume = useCallback(async () => {
		if (!isPaused) return;

		if (audioContextRef.current?.state === "suspended") {
			await audioContextRef.current.resume();
		}

		startTimeRef.current = Date.now();
		setIsPaused(false);

		timerRef.current = setInterval(() => {
			setElapsed(pausedElapsedRef.current + Date.now() - startTimeRef.current);
		}, 1000);

		if (sessionIdRef.current) {
			await resumeSessionMut({ sessionId: sessionIdRef.current });
		}
	}, [isPaused, resumeSessionMut]);

	const stop = useCallback(async () => {
		// Close WebSocket (sends terminate message)
		if (wsRef.current) {
			if (wsRef.current.readyState === WebSocket.OPEN) {
				wsRef.current.send(JSON.stringify({ terminate_session: true }));
			}
			wsRef.current.close();
			wsRef.current = null;
		}

		// Disconnect worklet and close audio context
		if (workletNodeRef.current) {
			workletNodeRef.current.disconnect();
			workletNodeRef.current = null;
		}
		if (audioContextRef.current) {
			await audioContextRef.current.close();
			audioContextRef.current = null;
		}

		// Stop media tracks
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
		setPartialTranscript("");
	}, [stopSessionMut]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
			if (wsRef.current) wsRef.current.close();
			if (audioContextRef.current) {
				audioContextRef.current.close().catch(() => {});
			}
			if (workletUrlRef.current) {
				URL.revokeObjectURL(workletUrlRef.current);
			}
		};
	}, []);

	return (
		<CaptureContext.Provider
			value={{
				isRecording,
				isPaused,
				elapsed,
				sessionId,
				error,
				partialTranscript,
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
