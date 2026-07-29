"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PencilSimpleLineIcon } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { SortAscendingIcon } from "@phosphor-icons/react/dist/csr/SortAscending";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AppShell } from "../../components/AppShell";
import { PageSkeleton, StatusMessage } from "../../components/AsyncState";
import { Button, LinkButton } from "../../components/Button";
import { TextField } from "../../components/FormField";
import {
  connectionAvatarUrl,
  connectionSourceLabel,
  createManualContact,
  enrichConnectionPhotos,
  fetchAllConnectionsMerged,
  filterConnections,
  formatConnectionDate,
  sortConnections,
  type ConnectionItem,
  type ConnectionSort,
} from "../../../lib/connections";
import "../product.css";
import "../flow.css";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ConnectionSort>("date");
  const [addOpen, setAddOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manual, setManual] = useState({ name: "", email: "", role: "", company: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const merged = await fetchAllConnectionsMerged();
      setConnections(merged);
      setLoading(false);
      setEnriching(true);
      void enrichConnectionPhotos(merged)
        .then(setConnections)
        .finally(() => setEnriching(false));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load connections.");
      setConnections([]);
      setLoading(false);
      setEnriching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleConnections = useMemo(
    () => sortConnections(filterConnections(connections, query), sort),
    [connections, query, sort],
  );

  async function saveManual() {
    setSavingManual(true);
    setError("");
    try {
      await createManualContact(manual);
      setManualOpen(false);
      setAddOpen(false);
      setManual({ name: "", email: "", role: "", company: "" });
      setSuccess(`${manual.name.trim()} was added to your connections.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this connection.");
    } finally {
      setSavingManual(false);
    }
  }

  const hasConnections = connections.length > 0;

  return (
    <AppShell
      active="people"
      title="Connections"
      subtitle="People you’ve met — cards you saved and people who shared their details with you."
      actions={
        <Button size="small" variant="secondary" onClick={() => setAddOpen(true)} aria-label="Add connection">
          <PlusIcon size={16} weight="bold" /> Add
        </Button>
      }
    >
      <div className="flow-page connections-page">
        <div className="flow-heading">
          <div>
            <h1>People you’ve met</h1>
            <p>Cards you saved and people who shared their details with you.</p>
          </div>
        </div>

        {success ? (
          <StatusMessage tone="success" action={<Button size="small" variant="ghost" onClick={() => setSuccess("")}>Dismiss</Button>}>
            {success}
          </StatusMessage>
        ) : null}
        {error ? (
          <StatusMessage tone="error" action={<Button size="small" variant="ghost" onClick={() => setError("")}>Dismiss</Button>}>
            {error}
          </StatusMessage>
        ) : null}

        {!loading && hasConnections ? (
          <div className="connections-toolbar">
            <label className="connections-search">
              <MagnifyingGlassIcon size={18} weight="bold" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search connections"
              />
            </label>
            <Button size="small" variant="secondary" onClick={() => setSortOpen(true)} aria-label="Sort connections">
              <SortAscendingIcon size={16} weight="bold" />
              {sort === "date" ? "Last added" : "A–Z"}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <PageSkeleton rows={5} />
        ) : hasConnections ? (
          <div className="connections-list">
            {enriching ? <p className="connections-enriching">Updating photos…</p> : null}
            {visibleConnections.map((connection) => (
              <a
                className="connections-row"
                key={connection.id}
                href={`/app/people/${encodeURIComponent(connection.id)}`}
              >
                <img
                  className="connections-avatar"
                  src={connection.photoUrl || connectionAvatarUrl(connection)}
                  alt=""
                />
                <div className="connections-copy">
                  <strong>{connection.name}</strong>
                  <span>{connection.subtitle}</span>
                  <small>
                    {connectionSourceLabel(connection.source)}
                    {connection.connectedAt ? ` · ${formatConnectionDate(connection.connectedAt)}` : ""}
                  </small>
                </div>
                <CaretRightIcon size={16} weight="bold" />
              </a>
            ))}
            {!visibleConnections.length ? (
              <p className="connections-empty-search">No connections match your search.</p>
            ) : null}
          </div>
        ) : (
          <button type="button" className="connections-empty-prompt" onClick={() => setAddOpen(true)}>
            <span className="empty-icon"><UsersThreeIcon size={22} weight="fill" /></span>
            <strong>No connections yet</strong>
            <span>Scan a card or add someone manually.</span>
          </button>
        )}
      </div>

      {addOpen ? (
        <div className="connections-modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div className="connections-modal" role="dialog" aria-label="Add connection" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>Add connection</h2>
              <button type="button" aria-label="Close" onClick={() => setAddOpen(false)}><XIcon size={18} weight="bold" /></button>
            </header>
            <p>Add someone you met by scanning their card or entering their details manually.</p>
            <div className="connections-add-options">
              <LinkButton href="/app/scan" onClick={() => setAddOpen(false)}>
                <QrCodeIcon size={18} weight="bold" /> Scan QR code
              </LinkButton>
              <Button
                variant="secondary"
                onClick={() => {
                  setAddOpen(false);
                  setManualOpen(true);
                }}
              >
                <PencilSimpleLineIcon size={18} weight="bold" /> Add manually
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="connections-modal-backdrop" role="presentation" onClick={() => setManualOpen(false)}>
          <div className="connections-modal" role="dialog" aria-label="Add manually" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>Add manually</h2>
              <button type="button" aria-label="Close" onClick={() => setManualOpen(false)}><XIcon size={18} weight="bold" /></button>
            </header>
            <form
              className="connections-manual-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveManual();
              }}
            >
              <TextField label="Name" value={manual.name} onChange={(event) => setManual((prev) => ({ ...prev, name: event.target.value }))} required />
              <TextField label="Email" type="email" value={manual.email} onChange={(event) => setManual((prev) => ({ ...prev, email: event.target.value }))} />
              <TextField label="Role" value={manual.role} onChange={(event) => setManual((prev) => ({ ...prev, role: event.target.value }))} />
              <TextField label="Company" value={manual.company} onChange={(event) => setManual((prev) => ({ ...prev, company: event.target.value }))} />
              <div className="form-actions">
                <Button type="button" variant="ghost" onClick={() => setManualOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={savingManual || !manual.name.trim()}>
                  {savingManual ? "Saving…" : "Save connection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {sortOpen ? (
        <div className="connections-modal-backdrop" role="presentation" onClick={() => setSortOpen(false)}>
          <div className="connections-modal connections-modal-compact" role="dialog" aria-label="Sort by" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>Sort by</h2>
              <button type="button" aria-label="Close" onClick={() => setSortOpen(false)}><XIcon size={18} weight="bold" /></button>
            </header>
            <div className="connections-add-options">
              <Button
                variant={sort === "date" ? "primary" : "secondary"}
                onClick={() => {
                  setSort("date");
                  setSortOpen(false);
                }}
              >
                Last added
              </Button>
              <Button
                variant={sort === "az" ? "primary" : "secondary"}
                onClick={() => {
                  setSort("az");
                  setSortOpen(false);
                }}
              >
                A–Z
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
