"use client";

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import type { BattleCurrentQuestion } from "@scholau/api";
import { normalizeGapAnswer } from "@scholau/core";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
};

export function BattleGapAnswer({
  question,
  value,
  disabled,
  onChange,
}: {
  question: BattleCurrentQuestion;
  value: string;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const toggleMic = () => {
    if (listening) {
      stop();
      return;
    }
    const W = window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-NG";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) onChange(normalizeGapAnswer(`${value} ${transcript}`));
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-wrap text-center text-lg font-bold leading-snug">{question.prompt}</p>
      <Field id="battle-gap-answer" label="Your answer">
        <Textarea
          id="battle-gap-answer"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type or use the microphone"
          rows={3}
        />
      </Field>
      <Button type="button" variant="outline" disabled={disabled} onClick={toggleMic}>
        {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
        {listening ? "Stop listening" : "Speak answer"}
      </Button>
    </div>
  );
}
