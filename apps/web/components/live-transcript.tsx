"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

// Animate words fading in one by one
function AnimatedWords({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const words = text.split(/(\s+)/);
  const [visibleCount, setVisibleCount] = useState(0);
  const prevTextRef = useRef(text);

  useEffect(() => {
    // If text changed completely (new segment), show all immediately
    if (prevTextRef.current !== text) {
      const isExtension = text.startsWith(prevTextRef.current);
      prevTextRef.current = text;

      if (isExtension) {
        // Text was extended — animate just the new words
        return;
      }
      // Completely new text — show all at once
      setVisibleCount(words.length);
      return;
    }
  }, [text, words.length]);

  useEffect(() => {
    if (visibleCount < words.length) {
      const timer = setTimeout(() => {
        setVisibleCount((c) => Math.min(c + 1, words.length));
      }, 30); // 30ms per word for smooth flow
      return () => clearTimeout(timer);
    }
  }, [visibleCount, words.length]);

  // Reset when text changes
  useEffect(() => {
    setVisibleCount(0);
  }, [text]);

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={`${i}-${word}`}
          className="transition-opacity duration-200 ease-out"
          style={{
            opacity: i < visibleCount ? 1 : 0,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

// Smooth partial transcript that doesn't jump
function SmoothPartial({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (text === displayText) return;

    // If new text is an extension of current, just update smoothly
    if (
      text.startsWith(displayText) ||
      displayText.startsWith(text) ||
      !displayText
    ) {
      setDisplayText(text);
      return;
    }

    // If text changed significantly, do a subtle crossfade
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayText(text);
      setIsTransitioning(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [text, displayText]);

  if (!displayText) return null;

  return (
    <span
      className={cn(
        "transition-opacity duration-150 ease-in-out",
        isTransitioning ? "opacity-50" : "opacity-70",
      )}
    >
      {displayText}
      <span className="inline-block w-[2px] h-[14px] ml-0.5 bg-[#08a39e] animate-[blink_1s_ease-in-out_infinite] align-text-bottom rounded-full" />
    </span>
  );
}

// Segment that fades in when it first appears
function FadeInSegment({
  children,
  isNew,
}: {
  children: React.ReactNode;
  isNew: boolean;
}) {
  const [visible, setVisible] = useState(!isNew);

  useEffect(() => {
    if (isNew) {
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }
  }, [isNew]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
      )}
    >
      {children}
    </div>
  );
}

export function LiveTranscriptPanel({
  sessionId,
}: {
  sessionId: Id<"capture_sessions">;
}) {
  const { partialTranscript, isRecording, isPaused } = useCapture();
  const segments = useQuery(api.capture.getTranscriptSegments, { sessionId });
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevSegCountRef = useRef(0);

  // Track which segments are new for animation
  const newSegmentThreshold = useMemo(() => {
    const prev = prevSegCountRef.current;
    if (segments) {
      prevSegCountRef.current = segments.length;
    }
    return prev;
  }, [segments?.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments?.length, partialTranscript]);

  if (!segments || segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
        {isRecording && !isPaused ? (
          <>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-10 h-10 rounded-full bg-[#08a39e]/10 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <div className="absolute w-6 h-6 rounded-full bg-[#08a39e]/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_0.5s_infinite]" />
              <div className="w-3 h-3 rounded-full bg-[#08a39e]/60 animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              Listening...
            </p>
          </>
        ) : isPaused ? (
          <>
            <MicOff className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Recording paused</p>
          </>
        ) : (
          <>
            <Mic className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Start recording to see live transcript
            </p>
          </>
        )}
        {partialTranscript && (
          <p className="text-sm italic text-muted-foreground/70 max-w-xs animate-in fade-in duration-300">
            <SmoothPartial text={partialTranscript} />
          </p>
        )}
      </div>
    );
  }

  // Group consecutive segments by speaker
  const grouped: Array<{
    speaker: string | undefined;
    segments: typeof segments;
    startIndex: number;
  }> = [];

  let idx = 0;
  for (const seg of segments) {
    const last = grouped[grouped.length - 1];
    if (last && last.speaker === seg.speaker) {
      last.segments.push(seg);
    } else {
      grouped.push({ speaker: seg.speaker, segments: [seg], startIndex: idx });
    }
    idx++;
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-3 space-y-3">
      <style jsx global>{`
				@keyframes blink {
					0%, 50% { opacity: 1; }
					51%, 100% { opacity: 0; }
				}
			`}</style>

      {grouped.map((group, gi) => {
        const firstSeg = group.segments[0];
        const label = speakerLabel(group.speaker);
        const color = speakerColor(group.speaker);
        const isNew = group.startIndex >= newSegmentThreshold;

        return (
          <FadeInSegment key={`${gi}-${firstSeg._id}`} isNew={isNew}>
            <div className="flex gap-3">
              {/* Timestamp gutter */}
              <div className="w-12 shrink-0 text-right pt-0.5">
                <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                  {formatTime(firstSeg.startMs)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {label && (
                  <p
                    className={cn(
                      "text-[10px] font-semibold mb-0.5 uppercase tracking-wider opacity-60",
                      color,
                    )}
                  >
                    {label}
                  </p>
                )}
                <p className="text-[13px] leading-[1.7] text-foreground/90">
                  {group.segments.map((s) => s.text).join(" ")}
                </p>
              </div>
            </div>
          </FadeInSegment>
        );
      })}

      {/* Partial transcript (streaming) — smooth */}
      {partialTranscript && (
        <div className="flex gap-3 animate-in fade-in duration-200">
          <div className="w-12 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] leading-[1.7] italic text-muted-foreground/60">
              <SmoothPartial text={partialTranscript} />
            </p>
          </div>
        </div>
      )}

      {/* Subtle waveform indicator when listening but no speech */}
      {isRecording && !isPaused && !partialTranscript && (
        <div className="flex gap-3 animate-in fade-in duration-500">
          <div className="w-12 shrink-0" />
          <div className="flex items-end gap-[3px] h-4">
            {[0, 0.15, 0.3, 0.15, 0].map((delay, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-[#08a39e]/30"
                style={{
                  animation: `waveform 1.2s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
				@keyframes waveform {
					0%, 100% { height: 4px; }
					50% { height: 14px; }
				}
			`}</style>

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}
