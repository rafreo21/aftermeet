const NAME_STOP_WORDS = new Set([
  "here", "with", "just", "going", "like", "right", "thank", "thanks", "yeah", "so", "today",
  "trying", "make", "things", "work", "myself", "my", "own", "side", "does", "direction", "that",
  "why", "this", "particular", "project", "has", "support", "out", "perfectly", "provide", "design",
  "supposed", "also", "answer", "the", "and", "all", "we", "are", "to", "on", "for", "me", "you",
]);

function titleCase(value: string) {
  return value.replace(/\b([a-z])/g, (char) => char.toUpperCase());
}

function cleanPhrase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^(?:the|a|an|like)\s+/i, "")
    .replace(/\b(?:that'?s why|right|thank you).*$/i, "")
    .trim();
}

function isPlausibleName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 3) return false;
  return parts.every((part) => !NAME_STOP_WORDS.has(part.toLowerCase()) && /^[A-Z][a-z'-]+$/.test(part));
}

export function segmentSpeechTranscript(transcript: string) {
  const punctuated = transcript.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  if (punctuated.length > 1) return punctuated;

  return transcript
    .replace(/\s+(?=(?:I'm|I am|We are|We were|They are|They're|Myself|Also|And also|The website|She|He|My own|On my|Thank you)\b)/gi, "\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function detectPersonName(transcript: string, hint = "") {
  if (hint.trim()) return hint.trim();

  const patterns = [
    /\b(?:my name is|I am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\b(?:here with|I'm here with|together with|meeting with|met with|speaking with|talking to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
    /\bmyself and\s+([A-Z][a-z]+)\b/i,
    /\b([A-Z][a-z]+)\s+and\s+I\s+are\s+supposed\b/i,
    /\b([A-Z][a-z]+)\s+(?:is|are)\s+(?:the\s+)?(?:lead|senior|head|chief)\b/i,
    /\b([A-Z][a-z]+)\s+(?:is|are)\s+supposed to\b/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const candidate = match?.[1]?.trim() ?? "";
    if (candidate && isPlausibleName(candidate)) return candidate;
  }

  const capitalized = [...transcript.matchAll(/\b([A-Z][a-z]+)\b/g)]
    .map((match) => match[1])
    .filter((word) => isPlausibleName(word));
  const counts = new Map<string, number>();
  capitalized.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  const repeated = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1]);
  return repeated[0]?.[0] ?? "";
}

export function extractTopics(transcript: string) {
  const topics = new Set<string>();

  for (const match of transcript.matchAll(/\b([A-Z][a-z]+(?:\s+[a-z]+){0,3}\s+section)\b/g)) {
    topics.add(titleCase(cleanPhrase(match[1])));
  }

  for (const match of transcript.matchAll(/\b(about page|address page|contact page|home page|landing page)\b/gi)) {
    topics.add(titleCase(match[1]));
  }

  if (/\bfix(?:ing)?\s+(?:the\s+)?website\b/i.test(transcript)) {
    topics.add("Website updates");
  }

  if (/\b(?:pilot|launch|rollout|roadmap|integration|migration)\b/i.test(transcript)) {
    const match = transcript.match(/\b((?:pilot|launch|rollout|roadmap|integration|migration)[^.!?]{0,40})/i);
    if (match?.[1]) topics.add(titleCase(cleanPhrase(match[1])));
  }

  return [...topics].slice(0, 6);
}

export function extractRole(transcript: string, personName: string) {
  const direct = transcript.match(/\b((?:lead|senior|head|chief)\s+(?:designer|engineer|product manager|developer|consultant|architect))\b/i)?.[1];
  if (direct) return cleanPhrase(direct);

  if (personName) {
    const scoped = transcript.match(
      new RegExp(`${personName}[^.!?]{0,40}\\b((?:lead|senior|head|chief)\\s+[A-Za-z\\s-]{2,30})`, "i"),
    )?.[1];
    if (scoped) return cleanPhrase(scoped);
  }

  return "";
}

export function extractOwnerContribution(transcript: string) {
  const match =
    transcript.match(/\b(?:my own side|on my side)[^.!?]*?\b(?:provide|focus on|handle|own)\s+([^.!?]{3,50})/i)
    ?? transcript.match(/\bI(?:'m| am)\s+(?:just\s+)?going to\s+provide\s+([^.!?]{3,40})/i)
    ?? transcript.match(/\bI(?:'ll| will)\s+([^.!?]{3,50})/i);

  if (!match?.[1]) return "";
  return cleanPhrase(match[1]);
}

export function buildSharedSummary(input: {
  personName: string;
  topics: string[];
  role: string;
  ownerContribution: string;
  transcript: string;
}) {
  const sentences: string[] = [];
  const topicText = input.topics.slice(0, 4).join(", ").replace(/,\s([^,]+)$/, ", and $1");

  if (input.personName && topicText) {
    sentences.push(`Met with ${input.personName} to work on ${topicText}.`);
  } else if (topicText) {
    sentences.push(`Discussed work on ${topicText}.`);
  } else if (input.personName) {
    sentences.push(`Met with ${input.personName} to align on next steps.`);
  }

  if (input.role) {
    sentences.push(`${input.personName || "They"} ${input.personName ? "is" : "are"} the ${input.role.toLowerCase()}.`);
  }

  if (input.ownerContribution) {
    sentences.push(`I will provide ${input.ownerContribution.toLowerCase()}.`);
  }

  if (!sentences.length) {
    const fallback = segmentSpeechTranscript(input.transcript).find((part) => part.length > 40);
    if (fallback) sentences.push(fallback);
  }

  return sentences.slice(0, 3).join(" ").trim();
}

export function buildPrivateNotes(input: {
  topics: string[];
  personName: string;
  role: string;
  ownerContribution: string;
  segments: string[];
}) {
  const bullets: string[] = [];

  if (input.topics.length) {
    bullets.push(`• Work discussed: ${input.topics.join("; ")}`);
  }

  if (input.personName && input.role) {
    bullets.push(`• ${input.personName}: ${input.role}`);
  } else if (input.personName) {
    bullets.push(`• Person: ${input.personName}`);
  }

  if (input.ownerContribution) {
    bullets.push(`• My contribution: ${titleCase(input.ownerContribution)}`);
  }

  if (bullets.length < 3) {
    input.segments
      .filter((segment) => segment.length > 28 && !/^(?:yeah|so|okay|ok)\b/i.test(segment))
      .slice(0, 2)
      .forEach((segment) => bullets.push(`• ${segment}`));
  }

  return bullets.slice(0, 6).join("\n");
}

export function buildMeetingTitle(input: { personName: string; topics: string[] }) {
  const primary =
    input.topics.find((topic) => /website updates/i.test(topic))
    ?? input.topics.find((topic) => /section|page|project|pilot|rollout/i.test(topic))
    ?? input.topics[0];

  if (primary && input.personName) return `${primary} with ${input.personName}`;
  if (primary) return primary;
  if (input.personName) return `Meeting with ${input.personName}`;
  return "New meeting";
}

export function buildFollowUp(input: { topics: string[]; transcript: string; ownerContribution: string }) {
  if (input.topics.length) {
    return `Complete work on ${input.topics.slice(0, 3).join(", ")}`;
  }
  const commitment = input.transcript.match(/\b(?:we are|we're|I am|I'm|they are|they're)\s+supposed to\s+([^.!?]+)/i)?.[1];
  if (commitment) return titleCase(cleanPhrase(commitment));
  if (input.ownerContribution) return titleCase(input.ownerContribution);
  return "";
}

export function inferFollowUpType(text: string) {
  if (/\blinkedin\b/i.test(text)) return "linkedin" as const;
  if (/\b(?:call|phone|ring)\b/i.test(text)) return "call" as const;
  if (/\b(?:schedule|book|meeting|coffee)\b/i.test(text)) return "meeting" as const;
  if (/\b(?:email|mail)\b/i.test(text)) return "email" as const;
  if (/\b(?:draft|file|document|deck|proposal|share|send|design|fix|build|ship|launch)\b/i.test(text)) return "send" as const;
  return "other" as const;
}
