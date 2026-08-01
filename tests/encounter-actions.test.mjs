import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { encounterFromApi, encounterFromSharedPayload, normalizeEncounterActions } from '../lib/encounters.ts';

const participants = [
  { id: 'sarah', name: 'Sarah Chen', email: 'sarah@example.com', phone: '', linkedIn: '' },
  { id: 'james', name: 'James Cole', email: 'james@example.com', phone: '', linkedIn: '' },
];

describe('normalizeEncounterActions', () => {
  it('keeps responsibility and relationship target as independent fields', () => {
    const [action] = normalizeEncounterActions([{
      id: 'action-1',
      title: 'Send the revised proposal',
      channel: 'email',
      owner: 'me',
      dueAt: '2026-08-03',
      status: 'open',
      participantId: 'james',
      assigneeName: 'stale name',
    }], participants);

    assert.equal(action.owner, 'me');
    assert.equal(action.participantId, 'james');
    assert.equal(action.assigneeName, 'James Cole');
    assert.equal(action.assigneeEmail, 'james@example.com');
  });

  it('recovers a missing participant id from the saved email', () => {
    const [action] = normalizeEncounterActions([{
      id: 'action-2',
      title: 'Review the deck',
      channel: 'send',
      owner: 'guest',
      dueAt: '',
      status: 'open',
      assigneeEmail: 'SARAH@example.com',
    }], participants);

    assert.equal(action.participantId, 'sarah');
    assert.equal(action.assigneeName, 'Sarah Chen');
  });

  it('drops malformed actions and applies safe enum defaults', () => {
    const actions = normalizeEncounterActions([
      null,
      { id: '', title: 'Missing id' },
      { id: 'valid', title: 'Call tomorrow', channel: 'fax', owner: 'unknown', status: 'maybe' },
    ], []);

    assert.equal(actions.length, 1);
    assert.equal(actions[0].channel, 'other');
    assert.equal(actions[0].owner, 'me');
    assert.equal(actions[0].status, 'open');
  });
});

describe('encounter action hydration', () => {
  const baseRow = {
    id: 'encounter-1',
    title: 'Coffee',
    person_name: 'Sarah Chen',
    person_email: 'sarah@example.com',
    contact_id: null,
    exchange_id: null,
    started_at: '2026-08-01T09:00:00.000Z',
    ended_at: '2026-08-01T09:30:00.000Z',
    duration_seconds: 1800,
    consent: { confirmed: true, method: 'verbal', confirmedAt: '2026-08-01T09:00:00.000Z', scriptVersion: '2026-07-26' },
    transcript: '',
    private_notes: '',
    shared_summary: '',
    recording_metadata: null,
    status: 'reviewed',
    share_token: 'share-token',
    guest_follow_up: null,
    participants,
  };

  it('repairs legacy server actions as encounters load', () => {
    const encounter = encounterFromApi({
      ...baseRow,
      actions: [{
        id: 'legacy-action',
        title: 'Send notes',
        channel: 'email',
        owner: 'me',
        dueAt: '',
        status: 'open',
        assigneeEmail: 'james@example.com',
      }],
    });

    assert.equal(encounter.actions[0].participantId, 'james');
    assert.equal(encounter.actions[0].assigneeName, 'James Cole');
  });

  it('uses the same repair path for participant shared views', () => {
    const encounter = encounterFromSharedPayload({
      id: 'shared-1',
      title: 'Coffee',
      personName: 'Sarah Chen',
      personEmail: 'sarah@example.com',
      participants,
      actions: [{
        id: 'shared-action',
        title: 'Review notes',
        channel: 'send',
        owner: 'guest',
        dueAt: '',
        status: 'open',
        assigneeName: 'James Cole',
      }],
    });

    assert.equal(encounter?.actions[0].participantId, 'james');
  });
});
