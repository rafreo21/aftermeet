import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  renameSpeakerAssignees,
  renameTranscriptSpeakers,
  transcriptSpeakerLabels,
} from '../lib/speaker-labels.ts';

describe('transcriptSpeakerLabels', () => {
  it('returns each diarized speaker once in transcript order', () => {
    const transcript = [
      'Speaker 1: I will send the proposal.',
      'Speaker 2: I will review it tomorrow.',
      'Speaker 1: Great, thank you.',
    ].join('\n');

    assert.deepEqual(transcriptSpeakerLabels(transcript), ['Speaker 1', 'Speaker 2']);
    assert.deepEqual(transcriptSpeakerLabels(transcript), ['Speaker 1', 'Speaker 2']);
  });
});

describe('renameTranscriptSpeakers', () => {
  it('replaces speaker labels while preserving the conversation', () => {
    const transcript = 'Speaker 1: I will send it.\nSpeaker 2: I will review it.';

    assert.equal(
      renameTranscriptSpeakers(transcript, {
        'Speaker 1': 'Me',
        'Speaker 2': 'Sarah Chen',
      }),
      'Me: I will send it.\nSarah Chen: I will review it.',
    );
  });
});

describe('renameSpeakerAssignees', () => {
  it('assigns my commitment to me without erasing its relationship target', () => {
    const [action] = renameSpeakerAssignees(
      [{ assigneeName: 'Speaker 1', owner: 'guest', participantId: 'stale-id' }],
      { 'Speaker 1': 'Me' },
      [],
    );

    assert.deepEqual(action, {
      assigneeName: 'Me',
      owner: 'me',
      participantId: 'stale-id',
    });
  });

  it('keeps the named relationship target when I own the commitment', () => {
    const [action] = renameSpeakerAssignees(
      [{ assigneeName: 'Speaker 1', owner: 'guest', participantId: 'person-sarah' }],
      { 'Speaker 1': 'Me' },
      [{ id: 'person-sarah', name: 'Sarah Chen' }],
    );

    assert.deepEqual(action, {
      assigneeName: 'Sarah Chen',
      owner: 'me',
      participantId: 'person-sarah',
    });
  });

  it('links a named speaker commitment to the matching participant', () => {
    const [action] = renameSpeakerAssignees(
      [{ assigneeName: 'speaker 2', owner: 'me' }],
      { 'Speaker 2': 'Sarah Chen' },
      [{ id: 'person-sarah', name: 'sarah chen' }],
    );

    assert.deepEqual(action, {
      assigneeName: 'Sarah Chen',
      owner: 'guest',
      participantId: 'person-sarah',
    });
  });
});
