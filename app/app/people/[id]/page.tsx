"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { AppShell } from "../../../components/AppShell";
import { PageSkeleton, StatusMessage } from "../../../components/AsyncState";
import { Button, LinkButton } from "../../../components/Button";
import {
  connectionSourceLabel,
  deleteConnection,
  fetchAllConnectionsMerged,
  type ConnectionItem,
} from "../../../../lib/connections";
import "../../product.css";
import "../../flow.css";

type Meeting = {
  id: string;
  title: string;
  startedAt: string;
  sharedSummary?: string;
  personName?: string;
  personEmail?: string;
};

type FollowUp = {
  encounterId: string;
  actionId: string;
  title: string;
  personName: string;
  personEmail: string;
  status: string;
  dueAt?: string;
};

function formatMeetingDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ConnectionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const connectionId = decodeURIComponent(params.id || "");
  const [connection, setConnection] = useState<ConnectionItem | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const connections = await fetchAllConnectionsMerged();
      const match = connections.find((item) => item.id === connectionId) || null;
      setConnection(match);
      if (!match) {
        setError("This connection could not be found.");
        setMeetings([]);
        setFollowUps([]);
        return;
      }

      const query = new URLSearchParams();
      query.set("contactId", match.id);
      query.set("sourceId", match.sourceId);
      if (match.email) query.set("email", match.email);
      if (match.source === "inbound") query.set("exchangeId", match.sourceId);

      const [meetingsRes, followUpsRes] = await Promise.all([
        fetch(`/api/encounters?${query.toString()}`, { cache: "no-store" }),
        fetch("/api/follow-ups", { cache: "no-store" }),
      ]);

      if (meetingsRes.ok) {
        const payload = await meetingsRes.json() as { encounters?: Meeting[] };
        setMeetings(payload.encounters ?? []);
      } else {
        setMeetings([]);
      }

      if (followUpsRes.ok) {
        const payload = await followUpsRes.json() as { followUps?: FollowUp[] };
        const name = match.name.trim().toLowerCase();
        const email = (match.email || "").trim().toLowerCase();
        setFollowUps((payload.followUps ?? []).filter((item) => {
          if (item.status === "completed" || item.status === "done") return false;
          if (email && item.personEmail?.trim().toLowerCase() === email) return true;
          return item.personName?.trim().toLowerCase() === name;
        }));
      } else {
        setFollowUps([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this connection.");
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const meetingPreview = useMemo(() => meetings.slice(0, 3), [meetings]);
  const followUpPreview = useMemo(() => followUps.slice(0, 2), [followUps]);

  async function confirmDelete() {
    if (!connection) return;
    if (!window.confirm(`Remove ${connection.name} from your connections?`)) return;
    setDeleting(true);
    try {
      await deleteConnection(connection);
      router.push("/app/people");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this connection.");
      setDeleting(false);
    }
  }

  const captureHref = connection
    ? `/app/encounters/new?personName=${encodeURIComponent(connection.name)}${connection.email ? `&personEmail=${encodeURIComponent(connection.email)}` : ""}${connection.source === "contact" ? `&contact=${encodeURIComponent(connection.sourceId)}` : ""}`
    : "/app/encounters/new";

  return (
    <AppShell
      active="people"
      title={connection?.name || "Connection"}
      subtitle={connection ? connectionSourceLabel(connection.source) : "People you’ve met"}
      actions={
        <div className="header-actions-row">
          <LinkButton size="small" variant="ghost" href="/app/people"><ArrowLeftIcon size={16} />Back</LinkButton>
          {connection ? (
            <Button size="small" variant="ghost" onClick={() => void confirmDelete()} disabled={deleting} aria-label="Remove connection">
              <TrashIcon size={16} weight="bold" />
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flow-page connections-page">
        {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        {loading ? (
          <PageSkeleton rows={4} />
        ) : connection ? (
          <>
            <div className="flow-heading">
              <div>
                <h1>{connection.name}</h1>
                <p>{connection.subtitle}</p>
                {meetings.length ? (
                  <small className="connections-count">
                    {meetings.length === 1 ? "1 conversation" : `${meetings.length} conversations`}
                  </small>
                ) : null}
              </div>
              <LinkButton href={captureHref}><MicrophoneIcon size={16} weight="fill" />Capture</LinkButton>
            </div>

            <section className="connections-section">
              <div className="connections-section-head">
                <h2>Meetings</h2>
              </div>
              {meetingPreview.length ? (
                <div className="connections-list">
                  {meetingPreview.map((meeting) => (
                    <a className="connections-row" key={meeting.id} href={`/app/encounters/${meeting.id}`}>
                      <div className="connections-copy">
                        <strong>{meeting.title?.trim() || "Meeting"}</strong>
                        <span>{formatMeetingDate(meeting.startedAt)}</span>
                        {meeting.sharedSummary?.trim() ? <small>{meeting.sharedSummary.trim()}</small> : null}
                      </div>
                      <CaretRightIcon size={16} weight="bold" />
                    </a>
                  ))}
                </div>
              ) : (
                <LinkButton variant="secondary" href={captureHref}>
                  <MicrophoneIcon size={16} weight="bold" />
                  No meetings yet — capture a conversation
                </LinkButton>
              )}
            </section>

            {followUpPreview.length ? (
              <section className="connections-section">
                <div className="connections-section-head">
                  <h2>Follow-ups</h2>
                  {followUps.length > 2 ? <LinkButton size="small" variant="ghost" href="/app/followups">View all</LinkButton> : null}
                </div>
                <div className="connections-list">
                  {followUpPreview.map((item) => (
                    <a className="connections-row" key={`${item.encounterId}-${item.actionId}`} href="/app/followups">
                      <div className="connections-copy">
                        <strong>{item.title}</strong>
                        <span>{item.dueAt ? `Due ${item.dueAt}` : "No due date"}</span>
                      </div>
                      <CaretRightIcon size={16} weight="bold" />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {connection.cardSlug ? (
              <a className="connections-card-cta" href={`/c/${encodeURIComponent(connection.cardSlug)}`}>
                <IdentificationCardIcon size={20} weight="bold" />
                <div>
                  <strong>View card</strong>
                  <span>Open their public AfterMeet card</span>
                </div>
                <CaretRightIcon size={16} weight="bold" />
              </a>
            ) : (
              <div className="connections-card-cta connections-card-cta-muted">
                <IdentificationCardIcon size={20} weight="bold" />
                <div>
                  <strong>No public card linked</strong>
                  <span>Save their details from a scan or inbound share.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div>
              <h2>Connection not found</h2>
              <p>This person may have been removed.</p>
              <LinkButton href="/app/people">Back to Connections</LinkButton>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
