/**
 * Unit tests for imageryHooks.isMajorArcana
 *
 * This is distinct from narrative/reasoning.js isMajorArcana, and is used
 * by narrative prompt helpers to decide whether to apply Major imagery hooks.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMajorArcana } from '../functions/lib/imageryHooks.js';

// Minimal expect() shim (mirrors other tests)
function expect(received) {
    return {
        toBe(expected) {
            assert.equal(received, expected);
        }
    };
}

describe('imageryHooks.isMajorArcana', () => {
    it('returns true for integer numbers 0–21', () => {
        expect(isMajorArcana(0)).toBe(true);
        expect(isMajorArcana(21)).toBe(true);
    });

    it('accepts numeric strings (but not empty/whitespace)', () => {
        expect(isMajorArcana('0')).toBe(true);
        expect(isMajorArcana(' 21 ')).toBe(true);
        expect(isMajorArcana('')).toBe(false);
        expect(isMajorArcana('   ')).toBe(false);
    });

    it('returns false for non-integers / non-finite values', () => {
        expect(isMajorArcana(1.5)).toBe(false);
        expect(isMajorArcana('3.14')).toBe(false);
        expect(isMajorArcana(NaN)).toBe(false);
        expect(isMajorArcana(Infinity)).toBe(false);
    });

    it('returns false for null/undefined/booleans', () => {
        expect(isMajorArcana(null)).toBe(false);
        expect(isMajorArcana(undefined)).toBe(false);
        expect(isMajorArcana(true)).toBe(false);
    });

    it('returns true for Major card-like objects', () => {
        expect(isMajorArcana({ number: 0, card: 'The Fool' })).toBe(true);
        expect(isMajorArcana({ number: '14', card: 'Temperance' })).toBe(true);
    });

    it('accepts Major numbers from alternate fields (cardNumber/card_number)', () => {
        expect(isMajorArcana({ cardNumber: 0, card: 'The Fool' })).toBe(true);
        expect(isMajorArcana({ card_number: '21', card: 'The World' })).toBe(true);
    });

    it('returns false for Minor card-like objects, even if `number` is present', () => {
        // Legacy payloads can mistakenly put pip values into `number`.
        expect(
            isMajorArcana({
                number: 1,
                card: 'Ace of Wands',
                suit: 'Wands',
                rank: 'Ace',
                rankValue: 1
            })
        ).toBe(false);

        // Also protect when suit/rank is missing but name clearly indicates a Minor.
        expect(isMajorArcana({ number: 3, card: 'Three of Cups' })).toBe(false);
    });

    it('returns false for Minor names with odd casing/whitespace', () => {
        // Corrupted-ish casing is common in user/legacy payloads.
        expect(isMajorArcana({ number: 3, card: 'three of cups' })).toBe(false);
        expect(isMajorArcana({ number: 13, card: '  queen of SWORDS  ' })).toBe(false);
    });
});
