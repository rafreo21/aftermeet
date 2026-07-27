import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractInterimTail,
  findSuffixPrefixOverlap,
  mergeFinalSegment,
} from '../mobile/src/lib/live-transcript-merge.ts';

describe('mergeFinalSegment', () => {
  it('appends a new segment after a pause', () => {
    assert.equal(
      mergeFinalSegment('hello world', 'how are you'),
      'hello world how are you',
    );
  });

  it('accepts cumulative finals from Android', () => {
    assert.equal(
      mergeFinalSegment('hello world', 'hello world how are you'),
      'hello world how are you',
    );
  });

  it('merges overlapping segment boundaries', () => {
    assert.equal(
      mergeFinalSegment('discussed the budget', 'budget and timeline'),
      'discussed the budget and timeline',
    );
  });

  it('does not drop new words when a phrase repeats inside committed text', () => {
    assert.equal(
      mergeFinalSegment('the meeting went well', 'and the meeting continues'),
      'the meeting went well and the meeting continues',
    );
  });
});

describe('extractInterimTail', () => {
  it('returns only the uncommitted tail of cumulative partials', () => {
    assert.equal(extractInterimTail('hello world', 'hello world again today'), 'again today');
  });

  it('returns fresh partial text after a pause', () => {
    assert.equal(extractInterimTail('hello world', 'again today'), 'again today');
  });
});

describe('findSuffixPrefixOverlap', () => {
  it('finds word-boundary overlap', () => {
    assert.equal(findSuffixPrefixOverlap('hello world', 'world today'), 'world'.length);
  });
});
