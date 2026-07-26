"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { AppShell } from "../../../components/AppShell";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, TextField } from "../../../components/FormField";
import { formatDuration, writeEncounter, type Encounter } from "../../../../lib/encounters";
import {
  deleteLocalRecording,
  removeExpiredLocalRecordings,
  saveLocalRecording,
  type AudioRetention,
} from "../../../../lib/local-recordings";
import "../../product.css";
import "../../flow.css";

type RecordingState = "idle" | "recording" | "paused" | "stopped";
type SpeechRecognitionEventLike = { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function wavBlob(chunks: Float32Array[], sampleRate: number) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  chunks.forEach((chunk) => chunk.forEach((sample) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }));
  return new Blob([buffer], { type: "audio/wav" });
}

function transcriptDraft(transcript: string, personName: string) {
  const clean = transcript.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const detectedName =
    clean.match(/\b(?:my name is|I am|I'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)?.[1] || "";
  const person = personName || detectedName;
  const topic = clean.match(/\b(?:discuss(?:ed|ing)?|talk(?:ed|ing)? about|working on|help with)\s+([^.!?]+)/i)?.[1]?.trim();
  const title = person
    ? `${topic ? `${topic[0].toUpperCase()}${topic.slice(1)}` : "Meeting"} with ${person}`
    : topic ? `${topic[0].toUpperCase()}${topic.slice(1)}` : "New meeting";
  const summary = sentences.slice(0, 3).join(" ");
  const notes = sentences.slice(0, 6).map((sentence) => `• ${sentence}`).join("\n");
  const followUpSentence = sentences.find((sentence) =>
    /\b(?:follow up|I(?:'ll| will)|we(?:'ll| will)|send|email|call|phone|connect|LinkedIn|schedule|book|share|draft)\b/i.test(sentence),
  ) || "";
  const followUpType: Encounter["actions"][number]["channel"] =
    /\blinkedin\b/i.test(followUpSentence) ? "linkedin"
      : /\b(?:call|phone|ring)\b/i.test(followUpSentence) ? "call"
        : /\b(?:schedule|book|meeting|coffee)\b/i.test(followUpSentence) ? "meeting"
          : /\b(?:draft|file|document|deck|proposal|share|send)\b/i.test(followUpSentence) ? "send"
            : /\b(?:email|mail)\b/i.test(followUpSentence) ? "email"
              : "other";
  return {
    title,
    personName: person,
    sharedSummary: summary,
    privateNotes: notes,
    followUp: followUpSentence.replace(/^[•\-]\s*/, ""),
    followUpType,
  };
}

export default function NewEncounterPage() {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const recordedFramesRef = useRef(0);
  const sampleRateRef = useRef(44100);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptFeedbackRef = useRef<number | null>(null);
  const transcriptAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingStateRef = useRef<RecordingState>("idle");
  const finalTranscriptRef = useRef("");
  const audioUrlRef = useRef("");
  const audioBlobRef = useRef<Blob | null>(null);
  const encounterIdRef = useRef("");
  const [consent, setConsent] = useState(false);
  const [consentMethod, setConsentMethod] = useState<"verbal" | "written">("verbal");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptSupported, setTranscriptSupported] = useState(true);
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "listening" | "receiving" | "unavailable">("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [draftMessage, setDraftMessage] = useState("");
  const [error, setError] = useState("");
  const [recordingSource, setRecordingSource] = useState<"recorded" | "imported">("recorded");
  const [retention, setRetention] = useState<AudioRetention>("7_days");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    personName: "",
    personEmail: "",
    transcript: "",
    privateNotes: "",
    sharedSummary: "",
    followUp: "",
    followUpType: "email" as Encounter["actions"][number]["channel"],
    dueAt: "",
  });

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    recognitionRef.current?.stop();
    if (transcriptFeedbackRef.current) window.clearTimeout(transcriptFeedbackRef.current);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    void removeExpiredLocalRecordings().catch(() => {});
  }, []);

  function replaceAudioUrl(nextUrl: string) {
    if (audioUrlRef.current && audioUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  }

  function releaseRecorderResources() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }

  useEffect(() => {
    const transcript = form.transcript.trim();
    if (transcript.length < 20) return;
    const timeout = window.setTimeout(() => {
      const draft = transcriptDraft(transcript, form.personName);
      if (!draft) return;
      setForm((current) => ({
        ...current,
        title: current.title || draft.title,
        personName: current.personName || draft.personName,
        privateNotes: current.privateNotes || draft.privateNotes,
        sharedSummary: current.sharedSummary || draft.sharedSummary,
        followUp: current.followUp || draft.followUp,
        followUpType: current.followUp ? current.followUpType : draft.followUpType,
      }));
      setDraftMessage("Meeting context and follow-up drafted from the transcript. Review before saving.");
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [form.transcript]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startTranscript() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setTranscriptSupported(false);
      setTranscriptStatus("unavailable");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    setTranscriptStatus("listening");
    if (transcriptFeedbackRef.current) window.clearTimeout(transcriptFeedbackRef.current);
    transcriptFeedbackRef.current = window.setTimeout(() => {
      if (!finalTranscriptRef.current.trim()) setTranscriptStatus("unavailable");
    }, 5000);
    recognition.onresult = (event) => {
      let interim = "";
      let completed = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) completed += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      if (completed) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${completed}`.trim();
        setForm((current) => ({ ...current, transcript: finalTranscriptRef.current }));
      }
      if (completed || interim) setTranscriptStatus("receiving");
      setInterimTranscript(interim);
    };
    recognition.onerror = () => {
      setTranscriptSupported(false);
      setTranscriptStatus("unavailable");
    };
    recognition.onend = () => {
      if (recordingStateRef.current === "recording") {
        try { recognition.start(); } catch {}
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch {
      setTranscriptSupported(false);
      setTranscriptStatus("unavailable");
    }
  }

  function generateMeetingContext(transcript = finalTranscriptRef.current || form.transcript) {
    const draft = transcriptDraft(transcript, form.personName);
    if (!draft) {
      setDraftMessage("Add or record some transcript before generating meeting context.");
      return;
    }
    setForm((current) => ({
      ...current,
      title: current.title || draft.title,
      personName: current.personName || draft.personName,
      privateNotes: current.privateNotes || draft.privateNotes,
      sharedSummary: current.sharedSummary || draft.sharedSummary,
      followUp: current.followUp || draft.followUp,
      followUpType: current.followUp ? current.followUpType : draft.followUpType,
    }));
    setDraftMessage("Meeting title, person, notes, summary, and follow-up were drafted from the transcript. Review before saving.");
  }

  async function startRecording() {
    setError("");
    if (!consent) {
      setError("Confirm that everyone agreed before recording.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) {
      setError("Audio recording is not supported in this browser. You can still add notes and a transcript.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextConstructor();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      streamRef.current = stream;
      audioContextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      pcmChunksRef.current = [];
      recordedFramesRef.current = 0;
      sampleRateRef.current = context.sampleRate;
      processor.onaudioprocess = (event) => {
        const samples = event.inputBuffer.getChannelData(0);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        setAudioLevel(Math.min(1, rms * 8));
        if (recordingStateRef.current !== "recording") return;
        const copy = new Float32Array(samples);
        pcmChunksRef.current.push(copy);
        recordedFramesRef.current += copy.length;
        setSeconds(Math.floor(recordedFramesRef.current / sampleRateRef.current));
      };
      source.connect(processor);
      processor.connect(context.destination);
      recordingStateRef.current = "recording";
      setRecordingState("recording");
      setTranscriptOpen(true);
      finalTranscriptRef.current = form.transcript;
      startTranscript();
    } catch {
      setError("Microphone access was not granted. Check your browser permission and try again.");
    }
  }

  function pauseOrResume() {
    if (recordingState === "recording") {
      recordingStateRef.current = "paused";
      recognitionRef.current?.stop();
      setRecordingState("paused");
      setAudioLevel(0);
    } else if (recordingState === "paused") {
      recordingStateRef.current = "recording";
      startTranscript();
      setRecordingState("recording");
    }
  }

  function stopRecording() {
    if (recordingStateRef.current === "stopped") return;
    recordingStateRef.current = "stopped";
    const exactSeconds = recordedFramesRef.current / sampleRateRef.current;
    setSeconds(Math.max(0, Math.round(exactSeconds)));
    releaseRecorderResources();
    const blob = wavBlob(pcmChunksRef.current, sampleRateRef.current);
    audioBlobRef.current = blob;
    setRecordingSource("recorded");
    replaceAudioUrl(URL.createObjectURL(blob));
    setAudioLevel(0);
    setInterimTranscript("");
    if ((finalTranscriptRef.current || form.transcript).trim()) {
      window.setTimeout(() => generateMeetingContext(finalTranscriptRef.current || form.transcript), 0);
    }
    setRecordingState("stopped");
  }

  async function importRecording(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!consent) {
      setError("Confirm that everyone agreed to the recording before importing it.");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setError("Choose an audio recording from Voice Memos, Files, or your device recorder.");
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setError("That recording is larger than 250 MB. Please choose a shorter or compressed recording.");
      return;
    }
    releaseRecorderResources();
    audioBlobRef.current = file;
    setRecordingSource("imported");
    const url = URL.createObjectURL(file);
    replaceAudioUrl(url);
    setTranscriptOpen(true);
    setRecordingState("stopped");
    setTranscriptStatus("idle");
    setDraftMessage("Recording imported. Add or paste its transcript, then draft the meeting context.");
    const audio = new Audio(url);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setSeconds(Math.max(0, Math.round(audio.duration)));
    };
    audio.onerror = () => setError("The recording was imported, but its duration could not be read by this browser.");
  }

  async function saveEncounter(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Recording consent must be confirmed for this encounter.");
      return;
    }
    if (!form.title.trim() && !form.personName.trim()) {
      setError("Add a meeting title or the name of the person you met.");
      return;
    }
    setSaving(true);
    const id = encounterIdRef.current || crypto.randomUUID();
    encounterIdRef.current = id;
    const now = new Date().toISOString();
    let recording: Encounter["recording"];
    if (audioBlobRef.current) {
      try {
        recording = await saveLocalRecording(id, audioBlobRef.current, {
          durationSeconds: seconds,
          source: recordingSource,
          retention,
        });
        if (retention === "after_transcription") await deleteLocalRecording(id);
      } catch {
        setSaving(false);
        setError("We could not save the recording on this device. Free some storage or choose “Delete after transcript”, then try again.");
        return;
      }
    }
    const encounter: Encounter = {
      id,
      title: form.title.trim() || `Meeting with ${form.personName.trim()}`,
      personName: form.personName.trim(),
      personEmail: form.personEmail.trim(),
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      endedAt: now,
      durationSeconds: seconds,
      consent: { confirmed: true, method: consentMethod, confirmedAt: now, scriptVersion: "2026-07-26" },
      transcript: form.transcript.trim(),
      privateNotes: form.privateNotes.trim(),
      sharedSummary: form.sharedSummary.trim(),
      recording,
      actions: form.followUp.trim() ? [{
        id: crypto.randomUUID(),
        title: form.followUp.trim(),
        channel: form.followUpType,
        owner: "me",
        dueAt: form.dueAt,
        status: "open",
      }] : [],
      status: "draft",
      shareToken: crypto.randomUUID().replaceAll("-", ""),
    };
    writeEncounter(encounter);
    try {
      const response = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encounter),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setSaving(false);
        setError(result?.error || "Saved on this device, but cloud sync failed. Press “Save and review” to retry.");
        return;
      }
    } catch {
      setSaving(false);
      setError("Saved on this device, but you appear to be offline. Reconnect and press “Save and review” to retry.");
      return;
    }
    const draft = encodeURIComponent(JSON.stringify(encounter));
    window.location.href = `/app/encounters/${id}?draft=${draft}`;
  }

  return (
    <AppShell
      active="home"
      title="Capture encounter"
      subtitle="Record with consent, remember what mattered, then review before anything is shared."
      actions={<LinkButton size="small" variant="ghost" href="/app"><ArrowLeftIcon size={16} />Close</LinkButton>}
    >
      <form className="encounter-layout" onSubmit={saveEncounter}>
        <section className="encounter-main">
          <div className="encounter-heading">
            <span className="step-pill">Private by default</span>
            <h1>Capture the conversation.</h1>
            <p>The recording and full transcript stay private. Only the summary and actions you approve can be shared.</p>
          </div>

          <section className={`consent-card ${consent ? "confirmed" : ""}`}>
            <div className="consent-icon">{consent ? <CheckCircleIcon size={28} weight="fill" /> : <MicrophoneIcon size={28} weight="bold" />}</div>
            <div>
              <h2>Confirm recording consent</h2>
              <p>Ask clearly: “Is everyone comfortable with me recording this conversation so I can remember the agreed next steps?”</p>
              <div className="consent-controls">
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Everyone agreed</label>
                <select value={consentMethod} onChange={(event) => setConsentMethod(event.target.value as "verbal" | "written")} aria-label="Consent method">
                  <option value="verbal">Verbal consent</option>
                  <option value="written">Written consent</option>
                </select>
              </div>
            </div>
          </section>

          <section className={`recorder-card ${recordingState === "recording" ? "is-recording" : ""}`}>
            <div className="recorder-status">
              <span className="record-dot" />
              <div><strong>{recordingState === "recording" ? "Recording" : recordingState === "paused" ? "Paused" : recordingState === "stopped" ? "Recording complete" : "Ready to record"}</strong><small>Microphone is {recordingState === "recording" ? "on" : "off"}</small></div>
              <time>{formatDuration(seconds)}</time>
            </div>
            {(recordingState === "recording" || recordingState === "paused") && <div className="audio-feedback" role="status" aria-live="polite">
              <div className="audio-meter" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => <span key={index} style={{ height: `${Math.max(4, audioLevel * (10 + ((index * 7) % 18)))}px` }} />)}
              </div>
              <strong>{recordingState === "paused" ? "Recording paused" : audioLevel > .08 ? "Voice detected" : "Listening for speech…"}</strong>
            </div>}
            <div className="recorder-actions">
              {recordingState === "idle" && <Button onClick={startRecording} disabled={!consent}><MicrophoneIcon size={18} weight="fill" />Start recording</Button>}
              {recordingState === "idle" && <label className={`import-recording-button ${!consent ? "disabled" : ""}`}>
                <UploadSimpleIcon size={18} weight="bold" />Import recording
                <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.aac,.ogg" disabled={!consent} onChange={importRecording} />
              </label>}
              {(recordingState === "recording" || recordingState === "paused") && <>
                <Button variant="secondary" onClick={pauseOrResume}>{recordingState === "paused" ? <PlayIcon size={18} weight="fill" /> : <PauseIcon size={18} weight="fill" />}{recordingState === "paused" ? "Resume" : "Pause"}</Button>
                <Button onClick={stopRecording}><StopIcon size={18} weight="fill" />Finish</Button>
              </>}
              {recordingState === "stopped" && <Button variant="secondary" onClick={() => { recordingStateRef.current = "idle"; recordedFramesRef.current = 0; pcmChunksRef.current = []; audioBlobRef.current = null; setRecordingState("idle"); setSeconds(0); replaceAudioUrl(""); setDraftMessage(""); setTranscriptStatus("idle"); }}>Record again</Button>}
              <Button variant="ghost" size="small" onClick={() => setTranscriptOpen((value) => !value)}>
                {transcriptOpen ? <CaretUpIcon size={15} weight="bold" /> : <CaretDownIcon size={15} weight="bold" />}
                {transcriptOpen ? "Hide transcript" : "Show transcript"}
              </Button>
            </div>
            {audioUrl && <audio className="audio-review" controls src={audioUrl} onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration)) setSeconds(Math.round(duration));
            }}>Your browser does not support audio playback.</audio>}
            {transcriptOpen && <div className="live-transcript">
              <header><div><strong>Live transcript</strong><small>{transcriptStatus === "receiving" ? "Receiving speech live" : transcriptStatus === "listening" ? "Listening for words…" : transcriptStatus === "unavailable" ? "Live transcription unavailable—audio is still recording" : "Editable meeting record"}</small></div><Button size="small" variant="secondary" onClick={() => generateMeetingContext(transcriptAreaRef.current?.value || finalTranscriptRef.current)}><MagicWandIcon size={15} weight="bold" />Draft meeting context</Button></header>
              <textarea
                ref={transcriptAreaRef}
                aria-label="Live transcript"
                rows={6}
                value={`${form.transcript}${interimTranscript ? `${form.transcript ? " " : ""}${interimTranscript}` : ""}`}
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  finalTranscriptRef.current = value;
                  setForm((current) => ({ ...current, transcript: value }));
                }}
                onChange={(event) => {
                  finalTranscriptRef.current = event.target.value;
                  update("transcript", event.target.value);
                }}
                placeholder={transcriptSupported ? "Your transcript will appear here while you record…" : "Live transcription is unavailable in this browser. Paste or type the transcript here."}
              />
              {!transcriptSupported && <small>Audio recording is working, but this browser could not provide live speech-to-text. You can type or paste a transcript here after recording.</small>}
              {draftMessage && <p>{draftMessage}</p>}
            </div>}
            {audioUrl && <div className="local-audio-settings">
              <div><strong>Private audio storage</strong><small>The audio stays in this browser on this device. Your transcript and approved meeting context can sync separately.</small></div>
              <label className="compact-field"><span>Keep audio</span><select value={retention} onChange={(event) => setRetention(event.target.value as AudioRetention)}>
                <option value="after_transcription">Delete after transcript</option>
                <option value="24_hours">For 24 hours</option>
                <option value="7_days">For 7 days</option>
                <option value="never">Until I delete it</option>
              </select></label>
            </div>}
            <small className="recording-note">{audioUrl ? `This ${recordingSource === "imported" ? "imported recording" : "recording"} will be stored locally when you save the encounter.` : "Record here or import audio from Voice Memos, Files, or your device recorder."}</small>
            {audioUrl && <a className="download-recording" href={audioUrl} download={`aftermeet-${Date.now()}.${audioBlobRef.current?.type.includes("wav") ? "wav" : "audio"}`}>Download recording</a>}
          </section>

          <section className="encounter-form-section">
            <header><h2>Meeting context</h2><p>Drafted from the transcript, then kept editable so you remain in control.</p></header>
            <div className="field-row two">
              <TextField label="Meeting title" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Coffee after ProductCon" />
              <TextField label="Person" value={form.personName} onChange={(event) => update("personName", event.target.value)} placeholder="Who were you speaking with?" />
            </div>
            <TextField label="Their email" hint="Used only for an invite you approve" type="email" value={form.personEmail} onChange={(event) => update("personEmail", event.target.value)} />
            <TextAreaField label="Private notes" hint="Only you" rows={4} value={form.privateNotes} onChange={(event) => update("privateNotes", event.target.value)} placeholder="Personal impressions, sensitive context, or anything that should never be shared." />
            <TextAreaField label="Shared meeting summary" hint="Review before sharing" rows={4} value={form.sharedSummary} onChange={(event) => update("sharedSummary", event.target.value)} placeholder="What did both of you agree happened, and what should each person remember?" />
            <div className="follow-up-builder">
              <div><h3>Follow-up</h3><p>What should happen next because of this conversation?</p></div>
              <label className="compact-field"><span>Follow-up type</span><select value={form.followUpType} onChange={(event) => setForm((current) => ({ ...current, followUpType: event.target.value as Encounter["actions"][number]["channel"] }))}><option value="email">Send an email</option><option value="call">Make a call</option><option value="linkedin">Connect on LinkedIn</option><option value="meeting">Schedule a meeting</option><option value="send">Send a draft or file</option><option value="other">Another action</option></select></label>
              <TextField label="What needs to be done?" value={form.followUp} onChange={(event) => update("followUp", event.target.value)} placeholder="e.g. Send Sarah the revised product draft" />
              <TextField label="Due date" type="date" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} />
            </div>
          </section>
          {error && <p className="encounter-error" role="alert">{error}</p>}
          <div className="form-actions"><LinkButton variant="ghost" href="/app">Cancel</LinkButton><Button type="submit" loading={saving}>Save and review</Button></div>
        </section>

        <aside className="privacy-rail">
          <span>What gets shared</span>
          <article><strong>Private to you</strong><p>Raw recording, full transcript, and private notes.</p></article>
          <article><strong>Shared after approval</strong><p>Meeting summary and explicitly assigned actions.</p></article>
          <article><strong>Guest access</strong><p>The other person receives a secure view and can claim their actions after signing up.</p></article>
        </aside>
      </form>
    </AppShell>
  );
}
