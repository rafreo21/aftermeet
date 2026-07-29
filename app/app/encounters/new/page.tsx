"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../../../components/AppShell";
import { ActiveCampaignField, defaultCampaignId } from "../../../components/ActiveCampaignField";
import { Button, LinkButton } from "../../../components/Button";
import { TextAreaField, SelectField, TextField } from "../../../components/FormField";
import { contactDisplayName, contactFromExchange, findContactById, readContacts, type Contact } from "../../../../lib/contacts";
import { linkEncountersToContact, resolveAndSaveContact } from "../../../../lib/person-links";
import { encounterToApiBody, formatDuration, writeEncounter, type Encounter } from "../../../../lib/encounters";
import {
  applyExtractionDraft,
  buildHeuristicDraft,
  EXTRACTION_DRAFT_NOTE,
  type EncounterExtractionDraft,
} from "../../../../lib/encounter-extraction";
import { cleanLiveTranscript } from "../../../../lib/transcript-cleanup";
import { transcribeEncounterAudioBlob } from "../../../../lib/encounter-transcription-client";
import {
  deleteLocalRecording,
  removeExpiredLocalRecordings,
  saveLocalRecording,
  type AudioRetention,
} from "../../../../lib/local-recordings";
import { uploadEncounterRecording } from "../../../../lib/recording-upload";
import "../../product.css";
import "../../flow.css";

type RecordingState = "idle" | "recording" | "paused" | "stopped";
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
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


type InboundExchange = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_company: string;
  visitor_role: string;
  note: string;
  status?: string;
  cards?: { full_name?: string; slug?: string } | { full_name?: string; slug?: string }[] | null;
};

const captureSteps = [
  { label: "Record", short: "Capture", Icon: MicrophoneIcon },
  { label: "Context", short: "Context", Icon: MagicWandIcon },
  { label: "Connect", short: "Connect", Icon: IdentificationCardIcon },
  { label: "Follow-up", short: "Follow-up", Icon: PaperPlaneTiltIcon },
  { label: "Review", short: "Review", Icon: EyeIcon, locked: true },
] as const;

const stepHeadings = [
  {
    title: "Record with consent.",
    copy: "Confirm consent, capture audio, then move on when you are ready. You can also skip recording and take notes only.",
  },
  {
    title: "Who did you meet?",
    copy: "Start with the person, then capture what mattered. Suggested drafts are starting points — not final truth.",
  },
  {
    title: "Connect their details.",
    copy: "Link this moment to someone in People, or share your card. Email syncs when they add you — not during capture.",
  },
  {
    title: "What happens next?",
    copy: "Add an optional follow-up, then continue to review before anything is shared.",
  },
] as const;

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
  const transcriptStatusRef = useRef<"idle" | "listening" | "receiving" | "unavailable" | "transcribing">("idle");
  const liveTranscriptReceivedRef = useRef(false);
  const transcriptAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingStateRef = useRef<RecordingState>("idle");
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const audioUrlRef = useRef("");
  const audioBlobRef = useRef<Blob | null>(null);
  const encounterIdRef = useRef("");
  const mainRef = useRef<HTMLElement | null>(null);
  const personNameRef = useRef<HTMLInputElement | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentMethod, setConsentMethod] = useState<"verbal" | "written">("verbal");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [transcriptSupported, setTranscriptSupported] = useState(true);
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "listening" | "receiving" | "unavailable" | "transcribing">("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftSource, setDraftSource] = useState<"ai" | "heuristic" | "">("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const extractionRequestRef = useRef(0);
  const [error, setError] = useState("");
  const [recordingSource, setRecordingSource] = useState<"recorded" | "imported">("recorded");
  const [retention, setRetention] = useState<AudioRetention>("7_days");
  const [saving, setSaving] = useState(false);
  const [captureStep, setCaptureStep] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [exchangeId, setExchangeId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [inboundExchanges, setInboundExchanges] = useState<InboundExchange[]>([]);
  const [form, setForm] = useState({
    title: "",
    personName: "",
    transcript: "",
    privateNotes: "",
    sharedSummary: "",
    followUp: "",
    followUpType: "email" as Encounter["actions"][number]["channel"],
    dueAt: "",
  });

  const linkedContact = useMemo(
    () => contacts.find((contact) => contact.id === contactId) ?? null,
    [contacts, contactId],
  );

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
    transcriptStatusRef.current = transcriptStatus;
  }, [transcriptStatus]);

  useEffect(() => {
    void removeExpiredLocalRecordings().catch(() => {});
  }, []);

  useEffect(() => {
    setContacts(readContacts());
    const presetContact = new URLSearchParams(window.location.search).get("contact");
    if (presetContact) {
      setContactId(presetContact);
      const contact = findContactById(presetContact);
      if (contact) {
        setForm((current) => ({ ...current, personName: contactDisplayName(contact) }));
        if (contact.campaignId) setCampaignId(contact.campaignId);
      }
    } else {
      setCampaignId(defaultCampaignId());
    }
    void fetch("/api/cards/exchanges")
      .then(async (response) => (response.ok ? response.json() : { exchanges: [] }))
      .then((payload: { exchanges?: InboundExchange[] }) => {
        setInboundExchanges((payload.exchanges ?? []).filter((exchange) => exchange.status === "new" || !exchange.status));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [captureStep]);

  useEffect(() => {
    if (captureStep !== 1) return;
    window.setTimeout(() => personNameRef.current?.focus(), 120);
  }, [captureStep]);

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

  function finalizeTranscript() {
    const merged = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, " ").trim();
    const cleaned = cleanLiveTranscript(merged);
    finalTranscriptRef.current = cleaned;
    interimTranscriptRef.current = "";
    setInterimTranscript("");
    setForm((current) => ({ ...current, transcript: cleaned }));
    return cleaned;
  }

  async function maybeTranscribeFromServer(blob: Blob, cleanedTranscript: string) {
    const needsServer =
      cleanedTranscript.trim().length < 20 ||
      transcriptStatusRef.current === "unavailable" ||
      !liveTranscriptReceivedRef.current;
    if (!needsServer) return cleanedTranscript;

    setTranscriptStatus("transcribing");
    const result = await transcribeEncounterAudioBlob(blob, { language: "en" });
    if (result.transcript) {
      finalTranscriptRef.current = result.transcript;
      setForm((current) => ({ ...current, transcript: result.transcript }));
      setTranscriptStatus("idle");
      return result.transcript;
    }

    setTranscriptStatus("unavailable");
    if (result.unavailable === "ai_not_configured") {
      setDraftMessage("Live speech-to-text is unavailable here. Paste or type a transcript, or configure AI Gateway for server transcription.");
    } else {
      setDraftMessage("Could not transcribe this recording automatically. Paste or type what was said.");
    }
    setDraftSource("");
    return cleanedTranscript;
  }

  async function generateMeetingContext(transcript = finalTranscriptRef.current || form.transcript) {
    const clean = cleanLiveTranscript(transcript.trim());
    if (clean.length < 20) {
      setDraftMessage("Add or record more transcript before generating meeting context.");
      setDraftSource("");
      setUncertainFields([]);
      return;
    }

    const requestId = extractionRequestRef.current + 1;
    extractionRequestRef.current = requestId;
    setDraftLoading(true);

    try {
      try {
        const response = await fetch("/api/encounters/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: clean, personName: form.personName }),
        });
        if (requestId !== extractionRequestRef.current) return;

        if (response.ok) {
          const payload = await response.json() as {
            draft: EncounterExtractionDraft;
            source: "ai" | "heuristic";
            uncertainFields?: string[];
            unavailable?: string;
            fallback?: boolean;
          };
          setForm((current) => applyExtractionDraft(current, payload.draft, { replace: true }));
          setDraftMessage(
            payload.unavailable === "ai_not_configured"
              ? EXTRACTION_DRAFT_NOTE.aiNotConfigured
              : payload.fallback
                ? EXTRACTION_DRAFT_NOTE.aiFallback
                : EXTRACTION_DRAFT_NOTE[payload.source],
          );
          setDraftSource(payload.source);
          setUncertainFields(payload.uncertainFields ?? []);
          return;
        }
      } catch {
        if (requestId !== extractionRequestRef.current) return;
      }

      const draft = buildHeuristicDraft(clean, form.personName);
      if (!draft) {
        setDraftMessage("Add or record more transcript before generating meeting context.");
        setDraftSource("");
        setUncertainFields([]);
        return;
      }
      setForm((current) => applyExtractionDraft(current, draft, { replace: true }));
      setDraftMessage(EXTRACTION_DRAFT_NOTE.heuristic);
      setDraftSource("heuristic");
      setUncertainFields([]);
    } finally {
      if (requestId === extractionRequestRef.current) setDraftLoading(false);
    }
  }

  useEffect(() => {
    const transcript = form.transcript.trim();
    if (transcript.length < 20) return;
    const timeout = window.setTimeout(() => {
      void generateMeetingContext(transcript);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [form.transcript]);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyContact(contact: Contact) {
    setContactId(contact.id);
    setExchangeId(contact.exchangeId ?? "");
    if (contact.campaignId) setCampaignId(contact.campaignId);
    setForm((current) => ({
      ...current,
      personName: contactDisplayName(contact) || current.personName,
    }));
  }

  function clearContactLink() {
    setContactId("");
    setExchangeId("");
  }

  function linkInboundExchange(exchange: InboundExchange) {
    const card = Array.isArray(exchange.cards) ? exchange.cards[0] : exchange.cards;
    const contact = resolveAndSaveContact({
      ...contactFromExchange(exchange, card?.full_name || "your card"),
      campaignId: campaignId || undefined,
    });
    setContacts(readContacts());
    applyContact(contact);
  }

  const stepCompletion = [
    consent && recordingState !== "recording" && recordingState !== "paused",
    Boolean(form.personName.trim() || form.title.trim()),
    Boolean(contactId || exchangeId || captureStep >= 3),
    Boolean(form.personName.trim()),
    false,
  ];

  function goToCaptureStep(nextStep: number) {
    setError("");
    setCaptureStep(nextStep);
  }

  function continueFromRecord(options?: { skipRecording?: boolean }) {
    setError("");
    if (!consent) {
      setError("Confirm that everyone agreed before continuing.");
      return;
    }
    if (!options?.skipRecording && (recordingState === "recording" || recordingState === "paused")) {
      setError("Finish the recording before moving to meeting context.");
      return;
    }
    if (form.transcript.trim()) void generateMeetingContext();
    else if (options?.skipRecording) {
      setDraftMessage("Add notes on the next step, or come back after recording.");
    }
    goToCaptureStep(1);
  }

  function continueFromContext() {
    setError("");
    if (!form.personName.trim()) {
      setError("Enter their full name.");
      personNameRef.current?.focus();
      return;
    }
    if (!form.title.trim() && !form.sharedSummary.trim() && !form.privateNotes.trim()) {
      setError("Add a meeting title or a short note about what you discussed.");
      return;
    }
    goToCaptureStep(2);
  }

  function continueFromConnect() {
    setError("");
    goToCaptureStep(3);
  }

  function startTranscript() {
    liveTranscriptReceivedRef.current = false;
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
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.replace(/\s+/g, " ").trim();
        } else {
          interim += `${interim ? " " : ""}${text}`;
        }
      }
      if (interim || finalTranscriptRef.current) liveTranscriptReceivedRef.current = true;
      if (finalTranscriptRef.current) {
        const cleaned = cleanLiveTranscript(finalTranscriptRef.current);
        finalTranscriptRef.current = cleaned;
        setForm((current) => ({ ...current, transcript: cleaned }));
      }
      interimTranscriptRef.current = interim;
      if (interim || finalTranscriptRef.current) setTranscriptStatus("receiving");
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
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      startTranscript();
    } catch {
      setError("Microphone access was not granted. Check your browser permission and try again.");
    }
  }

  function pauseOrResume() {
    if (recordingState === "recording") {
      finalizeTranscript();
      recordingStateRef.current = "paused";
      recognitionRef.current?.stop();
      setRecordingState("paused");
      setAudioLevel(0);
    } else if (recordingState === "paused") {
      recordingStateRef.current = "recording";
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      startTranscript();
      setRecordingState("recording");
    }
  }

  async function stopRecording() {
    if (recordingStateRef.current === "stopped") return;
    recordingStateRef.current = "stopped";
    const exactSeconds = recordedFramesRef.current / sampleRateRef.current;
    setSeconds(Math.max(0, Math.round(exactSeconds)));
    let cleanedTranscript = finalizeTranscript();
    releaseRecorderResources();
    const blob = wavBlob(pcmChunksRef.current, sampleRateRef.current);
    audioBlobRef.current = blob;
    setRecordingSource("recorded");
    replaceAudioUrl(URL.createObjectURL(blob));
    setAudioLevel(0);
    cleanedTranscript = await maybeTranscribeFromServer(blob, cleanedTranscript);
    if (cleanedTranscript) {
      window.setTimeout(() => generateMeetingContext(cleanedTranscript), 0);
    }
    setRecordingState("stopped");
    setTranscriptOpen(true);
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
    finalTranscriptRef.current = "";
    setForm((current) => ({ ...current, transcript: "" }));
    setTranscriptStatus("transcribing");
    setDraftMessage("Transcribing imported recording…");
    const serverTranscript = await maybeTranscribeFromServer(file, "");
    if (serverTranscript.trim().length >= 20) {
      void generateMeetingContext(serverTranscript);
      return;
    }
    setTranscriptStatus("idle");
    setDraftMessage("Recording imported. Add or paste its transcript, then draft the meeting context.");
    const audio = new Audio(url);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setSeconds(Math.max(0, Math.round(audio.duration)));
    };
    audio.onerror = () => setError("The recording was imported, but its duration could not be read by this browser.");
  }

  async function saveEncounter(event: React.FormEvent, options?: { skipFollowUp?: boolean }) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Recording consent must be confirmed for this encounter.");
      return;
    }
    if (!form.personName.trim()) {
      setError("Enter their full name before saving.");
      return;
    }
    if (!form.title.trim() && !form.sharedSummary.trim() && !form.privateNotes.trim()) {
      setError("Add a meeting title or a short note about what you discussed.");
      return;
    }
    setSaving(true);
    const followUpText = options?.skipFollowUp ? "" : form.followUp.trim();
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
    const personEmail = linkedContact?.email ?? "";
    let encounter: Encounter = {
      id,
      title: form.title.trim() || `Meeting with ${form.personName.trim()}`,
      personName: form.personName.trim(),
      personEmail,
      contactId: contactId || undefined,
      exchangeId: exchangeId || undefined,
      campaignId: campaignId || undefined,
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      endedAt: now,
      durationSeconds: seconds,
      consent: { confirmed: true, method: consentMethod, confirmedAt: now, scriptVersion: "2026-07-26" },
      transcript: form.transcript.trim(),
      privateNotes: form.privateNotes.trim(),
      sharedSummary: form.sharedSummary.trim(),
      recording,
      actions: followUpText ? [{
        id: crypto.randomUUID(),
        title: followUpText,
        channel: form.followUpType,
        owner: "me",
        dueAt: form.dueAt,
        status: "open",
      }] : [],
      status: "draft",
      shareToken: crypto.randomUUID().replaceAll("-", ""),
    };
    writeEncounter(encounter);
    const contactForLink = linkedContact ?? (contactId ? findContactById(contactId) : null);
    if (contactForLink) linkEncountersToContact(contactForLink);
    try {
      const response = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encounterToApiBody(encounter)),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setSaving(false);
        setError(result?.error || "Saved on this device, but cloud sync failed. Press “Save and review” to retry.");
        return;
      }
      if (audioBlobRef.current && recording) {
        try {
          const uploaded = await uploadEncounterRecording(id, audioBlobRef.current, recording.mimeType);
          encounter = { ...encounter, recording: uploaded };
          writeEncounter(encounter);
          await fetch("/api/encounters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(encounterToApiBody(encounter)),
          });
        } catch {
          // review screen can retry upload
        }
      }
    } catch {
      setSaving(false);
      setError("Saved on this device, but you appear to be offline. Reconnect and press “Save and review” to retry.");
      return;
    }
    const draft = encodeURIComponent(JSON.stringify(encounter));
    window.location.href = `/app/encounters/${id}?draft=${draft}`;
  }

  const privacyRail = [
    [
      { title: "Private to you", text: "Raw recording, full transcript, and anything you mark private." },
      { title: "Shared only after review", text: "Summary and actions are never sent automatically from this step." },
    ],
    [
      { title: "Private notes", text: "Only you ever see these, even after sharing the meeting record." },
      { title: "Shared summary", text: "The other person can see this only after you approve it on review." },
      { title: "Source transcript", text: "Keep the transcript open while editing so you stay grounded in what was said." },
    ],
    [
      { title: "Details sync on connect", text: "Email and contact methods arrive when you link someone from People or they share back from your card." },
      { title: "Share your card", text: "If you have not exchanged details yet, open your QR on the next screen." },
    ],
    [
      { title: "Optional next step", text: "Follow-up is not required. You can save now and add actions later." },
      { title: "Lands in Inbox", text: "Anything you add here becomes a task you can complete from Inbox." },
      { title: "Next: Review", text: "Review is where you confirm private vs shared content before anything goes out." },
    ],
  ] as const;

  const recordingComplete = recordingState === "stopped" || Boolean(audioUrl);

  return (
    <AppShell
      active="home"
      title="Capture encounter"
      subtitle="Record with consent, remember what mattered, then review before anything is shared."
      actions={<LinkButton size="small" variant="ghost" href="/app"><ArrowLeftIcon size={16} />Close</LinkButton>}
    >
      <form className="encounter-layout" onSubmit={saveEncounter}>
        <section className="encounter-main" ref={mainRef}>
          <div className="encounter-heading">
            <span className="step-pill">Step {captureStep + 1} of {captureSteps.length}</span>
            <h1>{stepHeadings[captureStep]?.title ?? "Review"}</h1>
            <p>{stepHeadings[captureStep]?.copy ?? ""}</p>
          </div>

          <nav className="creator-steps encounter-steps" aria-label="Encounter capture progress">
            {captureSteps.map(({ label, short, Icon, locked }, index) => (
              <button
                key={label}
                type="button"
                disabled={locked}
                title={locked ? "Opens after you save" : undefined}
                aria-current={index === captureStep ? "step" : undefined}
                aria-disabled={locked || undefined}
                className={[
                  index === captureStep ? "active" : "",
                  stepCompletion[index] ? "complete" : "",
                  locked ? "locked" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => {
                  if (locked || index === captureStep) return;
                  if (index < captureStep) {
                    goToCaptureStep(index);
                    return;
                  }
                  if (index === 1) continueFromRecord();
                  if (index === 2) continueFromContext();
                  if (index === 3) continueFromConnect();
                }}
              >
                <span>{stepCompletion[index] && index !== captureStep ? <CheckCircleIcon weight="fill" /> : <Icon weight="bold" />}</span>
                <small>{short}</small>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>

          {captureStep === 0 && <>
          <section className={`consent-card ${consent ? "confirmed" : ""}`}>
            <div className="consent-icon">{consent ? <CheckCircleIcon size={28} weight="fill" /> : <MicrophoneIcon size={28} weight="bold" />}</div>
            <div>
              <h2>Confirm recording consent</h2>
              <p>Ask clearly: “Is everyone comfortable with me recording this conversation so I can remember the agreed next steps?”</p>
              <div className="consent-controls">
                <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Everyone agreed</label>
                <SelectField compact hideLabel label="Consent method" className="consent-method-field" value={consentMethod} onChange={(event) => setConsentMethod(event.target.value as "verbal" | "written")}>
                  <option value="verbal">Verbal consent</option>
                  <option value="written">Written consent</option>
                </SelectField>
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
              <header><div><strong>Live transcript</strong><small>{transcriptStatus === "receiving" ? "Receiving speech live" : transcriptStatus === "listening" ? "Listening for words…" : transcriptStatus === "transcribing" ? "Transcribing recording…" : transcriptStatus === "unavailable" ? "Live transcription unavailable—audio is still recording" : "Editable meeting record"}</small></div></header>
              <textarea
                ref={transcriptAreaRef}
                aria-label="Live transcript"
                rows={6}
                value={`${form.transcript}${interimTranscript ? `${form.transcript ? " " : ""}${interimTranscript}` : ""}`}
                onInput={(event) => {
                  const value = cleanLiveTranscript(event.currentTarget.value);
                  finalTranscriptRef.current = value;
                  interimTranscriptRef.current = "";
                  setInterimTranscript("");
                  setForm((current) => ({ ...current, transcript: value }));
                }}
                onChange={(event) => {
                  const value = cleanLiveTranscript(event.target.value);
                  finalTranscriptRef.current = value;
                  interimTranscriptRef.current = "";
                  setInterimTranscript("");
                  update("transcript", value);
                }}
                placeholder={transcriptSupported ? "Your transcript will appear here while you record…" : "Live transcription is unavailable in this browser. Paste or type the transcript here."}
              />
              {!transcriptSupported && <small>Audio recording is working, but this browser could not provide live speech-to-text. AfterMeet will transcribe the recording when you stop, or you can type or paste a transcript here.</small>}
              {draftMessage && <p className="encounter-draft-note"><span className="encounter-draft-label">{draftSource === "ai" ? "AI draft" : "Suggested draft"}</span>{draftMessage.replace(/^(AI draft|Suggested draft)[^—]*—\s*/, "")}{draftLoading ? " Generating…" : ""}</p>}
              {uncertainFields.length > 0 && <p className="encounter-draft-uncertain">Double-check: {uncertainFields.join(", ")}</p>}
            </div>}
            <small className="recording-note">{audioUrl ? `This ${recordingSource === "imported" ? "imported recording" : "recording"} will be stored locally when you save the encounter.` : "Record here or import audio from Voice Memos, Files, or your device recorder."}</small>
            {audioUrl && <a className="download-recording" href={audioUrl} download={`aftermeet-${Date.now()}.${audioBlobRef.current?.type.includes("wav") ? "wav" : "audio"}`}>Download recording</a>}
          </section>

          {recordingComplete && captureStep === 0 && (
            <div className="encounter-success-banner" role="status">
              <CheckCircleIcon size={22} weight="fill" />
              <div>
                <strong>Recording ready</strong>
                <p>{form.transcript.trim() ? "We will draft meeting context from your transcript on the next step." : "Continue to add meeting context, or paste a transcript first."}</p>
              </div>
            </div>
          )}

          {error && <p className="encounter-error" role="alert">{error}</p>}
          <div className="form-actions encounter-step-actions">
            <LinkButton variant="ghost" href="/app">Cancel</LinkButton>
            <div className="encounter-step-actions-primary">
              {consent && recordingState === "idle" && !audioUrl && (
                <Button type="button" variant="ghost" onClick={() => continueFromRecord({ skipRecording: true })}>
                  Skip recording
                </Button>
              )}
              <Button type="button" onClick={() => continueFromRecord()} disabled={!consent || recordingState === "recording" || recordingState === "paused"} className={recordingComplete ? "encounter-primary-ready" : undefined}>
                {recordingComplete ? "Next: meeting context" : "Continue"} <ArrowRightIcon size={18} weight="bold" />
              </Button>
            </div>
          </div>
          </>}

          {captureStep === 1 && <>
          {form.transcript.trim() && (
            <section className="encounter-source-panel">
              <button type="button" className="encounter-source-toggle" onClick={() => setSourceOpen((value) => !value)} aria-expanded={sourceOpen}>
                <div><strong>Source transcript</strong><small>Reference what was said while you edit the summary.</small></div>
                {sourceOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
              </button>
              {sourceOpen && <TextAreaField label="Transcript" hint="Private" rows={5} value={form.transcript} onChange={(event) => update("transcript", event.target.value)} />}
            </section>
          )}
          <section className="encounter-form-section">
            <header><h2>Meeting context</h2><p>Who was it with and what mattered? Contact details sync on the next step.</p></header>
            {draftMessage && <p className="encounter-draft-note"><span className="encounter-draft-label">{draftSource === "ai" ? "AI draft" : "Suggested draft"}</span>{draftMessage.replace(/^(AI draft|Suggested draft)[^—]*—\s*/, "")}{draftLoading ? " Generating…" : ""}</p>}
            {uncertainFields.length > 0 && <p className="encounter-draft-uncertain">Double-check: {uncertainFields.join(", ")}</p>}
            {contacts.length > 0 && (
              <SelectField
                label="Pick from People"
                hint="Optional"
                value={contactId}
                onChange={(event) => {
                  const id = event.target.value;
                  if (!id) {
                    clearContactLink();
                    return;
                  }
                  const contact = contacts.find((item) => item.id === id);
                  if (contact) applyContact(contact);
                }}
              >
                <option value="">Type a name below…</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contactDisplayName(contact)}{contact.company ? ` · ${contact.company}` : ""}
                  </option>
                ))}
              </SelectField>
            )}
            <TextField
              ref={personNameRef}
              label="Full name"
              value={form.personName}
              onChange={(event) => {
                clearContactLink();
                update("personName", event.target.value);
              }}
              placeholder="e.g. Sarah Chen"
              autoComplete="name"
              autoFocus
            />
            <ActiveCampaignField value={campaignId} onChange={setCampaignId} />
            <TextField label="Meeting title" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Coffee after ProductCon" hint="Optional if the full name is enough" />
            <TextAreaField label="Private notes" hint="Only you — what they said that matters" rows={4} value={form.privateNotes} onChange={(event) => update("privateNotes", event.target.value)} placeholder="Key points from the other person: their priorities, constraints, commitments, and anything you'd want to remember later." />
            <TextAreaField label="Shared meeting summary" hint="Review before sharing" rows={4} value={form.sharedSummary} onChange={(event) => update("sharedSummary", event.target.value)} placeholder="What you both discussed and agreed — neutral enough to share with them." />
            {form.transcript.trim() && <Button type="button" variant="secondary" loading={draftLoading} onClick={() => void generateMeetingContext()}><MagicWandIcon size={15} weight="bold" />{draftLoading ? "Generating draft…" : "Regenerate draft"}</Button>}
          </section>
          {error && <p className="encounter-error" role="alert">{error}</p>}
          <div className="form-actions encounter-step-actions">
            <Button type="button" variant="ghost" onClick={() => goToCaptureStep(0)}><ArrowLeftIcon size={16} />Back</Button>
            <Button type="button" onClick={continueFromContext}>
              Next: connect <ArrowRightIcon size={18} weight="bold" />
            </Button>
          </div>
          </>}

          {captureStep === 2 && <>
          <section className="encounter-form-section encounter-connect-section">
            <header><h2>Connect</h2><p>Link this moment to a person. Email and contact methods sync here—not during capture.</p></header>
            {linkedContact ? (
              <div className="encounter-linked-person">
                <CheckCircleIcon size={24} weight="fill" />
                <div>
                  <strong>{contactDisplayName(linkedContact)}</strong>
                  <small>{linkedContact.email || linkedContact.company || linkedContact.role || "Linked from People"}</small>
                </div>
                <Button type="button" variant="ghost" size="small" onClick={clearContactLink}>Change</Button>
              </div>
            ) : (
              <>
                {inboundExchanges.length > 0 && (
                  <div className="encounter-inbound-list">
                    <span className="encounter-connect-label">Shared back from your card</span>
                    {inboundExchanges.map((exchange) => (
                      <button key={exchange.id} type="button" className="encounter-inbound-row" onClick={() => linkInboundExchange(exchange)}>
                        <strong>{exchange.visitor_name}</strong>
                        <small>{exchange.visitor_email || exchange.visitor_company || "No email yet"}</small>
                      </button>
                    ))}
                  </div>
                )}
                <div className="encounter-connect-actions">
                  <LinkButton variant="secondary" href="/app/cards#share"><QrCodeIcon size={16} weight="bold" />Share your card</LinkButton>
                  <LinkButton variant="ghost" href="/app/contacts"><UsersThreeIcon size={16} weight="bold" />Open People</LinkButton>
                </div>
                <p className="follow-up-note">You can continue without linking—add their details later from People.</p>
              </>
            )}
          </section>
          {error && <p className="encounter-error" role="alert">{error}</p>}
          <div className="form-actions encounter-step-actions">
            <Button type="button" variant="ghost" onClick={() => goToCaptureStep(1)}><ArrowLeftIcon size={16} />Back</Button>
            <Button type="button" onClick={continueFromConnect}>
              Next: follow-up <ArrowRightIcon size={18} weight="bold" />
            </Button>
          </div>
          </>}

          {captureStep === 3 && <>
          <section className="encounter-recap">
            <span className="step-pill">Meeting recap</span>
            <h2>{form.personName.trim() || form.title.trim() || "Untitled meeting"}</h2>
            <p className="encounter-recap-copy">{form.personName.trim() && form.title.trim() ? form.title.trim() : form.personName.trim() ? "Add a title on the previous step if helpful." : "Add a person on the previous step if you can."}{form.sharedSummary.trim() ? ` · ${form.sharedSummary.trim()}` : ""}</p>
          </section>
          {audioUrl && (
            <section className="encounter-advanced-panel">
              <button type="button" className="encounter-advanced-toggle" onClick={() => setAudioSettingsOpen((value) => !value)} aria-expanded={audioSettingsOpen}>
                <div><strong>Advanced: private audio storage</strong><small>Choose how long this device keeps the recording. Transcript and notes sync separately.</small></div>
                {audioSettingsOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
              </button>
              {audioSettingsOpen && (
                <div className="local-audio-settings">
                  <div><strong>Keep audio on this device</strong><small>The audio stays in this browser. Your transcript and approved meeting context can sync separately.</small></div>
                  <SelectField label="Retention" value={retention} onChange={(event) => setRetention(event.target.value as AudioRetention)}>
                    <option value="after_transcription">Delete after transcript</option>
                    <option value="24_hours">For 24 hours</option>
                    <option value="7_days">For 7 days</option>
                    <option value="never">Until I delete it</option>
                  </SelectField>
                </div>
              )}
            </section>
          )}
          <section className="encounter-form-section encounter-followup-section">
            <header><h2>Follow-up</h2><p>Optional. Add one next step now, or save and handle it later from review.</p></header>
            <div className="follow-up-fields">
              <TextField label="What needs to be done?" value={form.followUp} onChange={(event) => update("followUp", event.target.value)} placeholder="e.g. Send Sarah the revised product draft" />
              <div className="follow-up-meta">
                <SelectField label="Follow-up type" value={form.followUpType} onChange={(event) => setForm((current) => ({ ...current, followUpType: event.target.value as Encounter["actions"][number]["channel"] }))}>
                  <option value="email">Send an email</option>
                  <option value="call">Make a call</option>
                  <option value="linkedin">Connect on LinkedIn</option>
                  <option value="meeting">Schedule a meeting</option>
                  <option value="send">Send a draft or file</option>
                </SelectField>
                <TextField label="Due date" type="date" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} />
              </div>
              <p className="follow-up-note">This becomes an item in your Inbox until you complete it.</p>
            </div>
            {error && <p className="encounter-error" role="alert">{error}</p>}
            <div className="form-actions encounter-step-actions">
              <Button type="button" variant="ghost" onClick={() => goToCaptureStep(2)}><ArrowLeftIcon size={16} />Back</Button>
              <div className="encounter-step-actions-primary">
                <Button type="button" variant="ghost" loading={saving} onClick={(event) => void saveEncounter(event, { skipFollowUp: true })}>Save without follow-up</Button>
                <Button type="submit" loading={saving}>Save and review (step 5)</Button>
              </div>
            </div>
          </section>
          </>}
        </section>

        <aside className="privacy-rail encounter-privacy-rail">
          <span>{captureStep === 0 ? "Before you continue" : captureStep === 1 ? "While you edit" : captureStep === 2 ? "While you connect" : "Before you save"}</span>
          {(privacyRail[captureStep] ?? privacyRail[3]).map((item) => (
            <article key={item.title}><strong>{item.title}</strong><p>{item.text}</p></article>
          ))}
        </aside>
      </form>
    </AppShell>
  );
}
