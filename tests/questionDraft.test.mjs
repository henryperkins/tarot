import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  GUEST_DRAFT_OWNER,
  QUESTION_DRAFT_STORAGE_KEY,
  clearQuestionDraft,
  getQuestionDraftOwner,
  loadQuestionDraft,
  saveQuestionDraft
} from '../src/lib/questionDraft.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    size: () => values.size
  };
}

describe('question draft', () => {
  let storage;
  beforeEach(() => {
    storage = createStorage();
  });

  it('names owners by account, with one guest owner', () => {
    assert.equal(getQuestionDraftOwner('u1'), 'user:u1');
    assert.equal(getQuestionDraftOwner(null), GUEST_DRAFT_OWNER);
  });

  it('returns the question for the same owner', () => {
    saveQuestionDraft('user:u1', 'How can I rest this week?', storage);
    assert.equal(loadQuestionDraft('user:u1', storage), 'How can I rest this week?');
  });

  it('never returns another account\'s question', () => {
    saveQuestionDraft('user:u1', 'Private question', storage);
    assert.equal(loadQuestionDraft('user:u2', storage), '');
    assert.equal(loadQuestionDraft(GUEST_DRAFT_OWNER, storage), '');
  });

  it('carries a question written before signing in', () => {
    saveQuestionDraft(GUEST_DRAFT_OWNER, 'What is shifting at home?', storage);
    assert.equal(loadQuestionDraft('user:u1', storage), 'What is shifting at home?');
  });

  it('removes the draft when the field is emptied or cleared', () => {
    saveQuestionDraft(GUEST_DRAFT_OWNER, 'Draft', storage);
    saveQuestionDraft(GUEST_DRAFT_OWNER, '   ', storage);
    assert.equal(storage.size(), 0);
    saveQuestionDraft(GUEST_DRAFT_OWNER, 'Draft', storage);
    clearQuestionDraft(storage);
    assert.equal(storage.size(), 0);
  });

  it('keeps emoji, accents and right-to-left text intact', () => {
    const text = 'Comment avancer? 🌙 ما الذي يتغير؟ 何を学ぶ?';
    saveQuestionDraft(GUEST_DRAFT_OWNER, text, storage);
    assert.equal(loadQuestionDraft(GUEST_DRAFT_OWNER, storage), text);
  });

  it('survives corrupt or blocked storage', () => {
    storage.setItem(QUESTION_DRAFT_STORAGE_KEY, '{not json');
    assert.equal(loadQuestionDraft(GUEST_DRAFT_OWNER, storage), '');
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); }
    };
    assert.equal(loadQuestionDraft(GUEST_DRAFT_OWNER, blocked), '');
    assert.doesNotThrow(() => saveQuestionDraft(GUEST_DRAFT_OWNER, 'Draft', blocked));
    assert.doesNotThrow(() => clearQuestionDraft(blocked));
    assert.equal(loadQuestionDraft(GUEST_DRAFT_OWNER, null), '');
  });
});
