"use client";

import { useEffect, useState } from "react";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { AppShell } from "../../components/AppShell";
import { PageSkeleton } from "../../components/AsyncState";
import { LinkButton } from "../../components/Button";
import "../product.css";
import "../flow.css";

type PeopleConnection = {
  id: string;
  personName: string;
  personRole: string;
  personCompany: string;
  personEmail: string;
  cardSlug: string;
  cardOwnerName: string;
  connectedAt: string;
};

export default function PeoplePage() {
  const [connections, setConnections] = useState<PeopleConnection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/people/connections")
      .then(async (response) => {
        if (!response.ok) {
          setError("We couldn’t load people you’ve met.");
          return;
        }
        const payload = await response.json() as { connections?: PeopleConnection[] };
        setConnections(payload.connections ?? []);
      })
      .catch(() => setError("We couldn’t load people you’ve met."))
      .finally(() => setHydrated(true));
  }, []);

  return (
    <AppShell
      active="people"
      title="People you've met"
      subtitle="Cards you've saved and people you've exchanged details with — without a full CRM setup."
    >
      <div className="flow-page">
        <div className="flow-heading">
          <div>
            <h1>Your network starts here.</h1>
            <p>Scan a card, share your details back, or open a shared meeting record. Everyone you connect with lands in one place.</p>
          </div>
        </div>
        {!hydrated ? <PageSkeleton rows={3} /> : error ? (
          <div className="empty-state"><div><h2>Couldn’t load your people</h2><p>{error}</p></div></div>
        ) : connections.length ? (
          <div className="people-connection-list">
            {connections.map((connection) => (
              <article className="people-connection-row" key={connection.id}>
                <span className="contact-avatar">{connection.cardOwnerName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>
                <div>
                  <h3>{connection.cardOwnerName}</h3>
                  <p>{[connection.personRole, connection.personCompany].filter(Boolean).join(" · ") || "Connected through AfterMeet"}</p>
                  <small>Connected {new Date(connection.connectedAt).toLocaleDateString()}</small>
                </div>
                <LinkButton size="small" variant="secondary" href={`/c/${encodeURIComponent(connection.cardSlug)}`}>
                  <IdentificationCardIcon size={16} weight="bold" />Open card
                </LinkButton>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <span className="empty-icon"><UsersThreeIcon size={32} weight="bold" /></span>
              <h2>No connections yet</h2>
              <p>Scan someone’s AfterMeet card or share your details back. Sign in with Google to remember who you’ve met.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
