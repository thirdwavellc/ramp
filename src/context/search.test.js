import fuzzysort, { indexes } from 'fuzzysort';
import { findTokenIndex, indexesToTokens, tokenize, tokenizeSearchQuery } from './search';

describe('search', () => {
    const fixtures = [
        'So he rinsed the soap off.',
        'Some children are messy when they drink milk, but not Phil.'
    ];
    test('translating fuzzysort\'s result._indexes to tokens', () => {
        const result = fuzzysort.single('sohe', fixtures[0]);
        const tokens = tokenize(fixtures[0]);

        // its not a true array so we'll test by stringifying
        expect(indexes(result)).toEqual([0, 1, 3, 4]);
        expect(indexesToTokens(tokens, result._indexes)).toEqual([
            { kind: 'word', value: 'So', codepoints: ['S', 'o'], start: 0, end: 2 },
            { kind: 'word', value: 'So', codepoints: ['S', 'o'], start: 0, end: 2 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 3, end: 5 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 3, end: 5 }
        ]);
    });
    test('fuzzysort returns discontinuous matches', () => {
        const result = fuzzysort.single('sohe', fixtures[1]);
        expect(indexes(result)).toEqual([0, 1, 6, 11]);
    });
});

describe('tokenizer', () => {
    test('tokenize a search query', () => {
        expect(tokenizeSearchQuery('red apple')).toEqual(['red', 'apple']);
        expect(tokenizeSearchQuery(`sarah's automobile`)).toEqual(['sarahs', 'automobile']);
        expect(tokenizeSearchQuery('first 2nd next-to-last')).toEqual(['first', '2nd', 'nexttolast']);
    });
    test('tokenize a simple string', () => {
        const tokens = tokenize('Then he rinsed the soap off.');
        expect(tokens).toEqual([
            { kind: 'word', value: 'Then', codepoints: ['T', 'h', 'e', 'n'], start: 0, end: 4 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 4, end: 5 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 5, end: 7 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 7, end: 8 },
            { kind: 'word', value: 'rinsed', codepoints: ['r', 'i', 'n', 's', 'e', 'd'], start: 8, end: 14 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 14, end: 15 },
            { kind: 'word', value: 'the', codepoints: ['t', 'h', 'e'], start: 15, end: 18 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 18, end: 19 },
            { kind: 'word', value: 'soap', codepoints: ['s', 'o', 'a', 'p'], start: 19, end: 23 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 23, end: 24 },
            { kind: 'word', value: 'off', codepoints: ['o', 'f', 'f'], start: 24, end: 27 },
            { kind: 'other', value: '.', codepoints: ['.'], start: 27, end: 28 }
        ]);
    });
    test('tokenize a more complex string', () => {
        const tokens = tokenize('Phil\twon 2nd place in the "race"!');
        expect(tokens).toEqual([
            { kind: 'word', value: 'Phil', codepoints: ['P', 'h', 'i', 'l'], start: 0, end: 4 },
            { kind: 'whitespace', value: '\t', codepoints: ['\t'], start: 4, end: 5 },
            { kind: 'word', value: 'won', codepoints: ['w', 'o', 'n'], start: 5, end: 8 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 8, end: 9 },
            { kind: 'word', value: '2nd', codepoints: ['2', 'n', 'd'], start: 9, end: 12 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 12, end: 13 },
            { kind: 'word', value: 'place', codepoints: ['p', 'l', 'a', 'c', 'e'], start: 13, end: 18 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 18, end: 19 },
            { kind: 'word', value: 'in', codepoints: ['i', 'n'], start: 19, end: 21 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 21, end: 22 },
            { kind: 'word', value: 'the', codepoints: ['t', 'h', 'e'], start: 22, end: 25 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 25, end: 26 },
            { kind: 'other', value: '"', codepoints: ['"'], start: 26, end: 27 },
            { kind: 'word', value: 'race', codepoints: ['r', 'a', 'c', 'e'], start: 27, end: 31 },
            { kind: 'other', value: '"!', codepoints: ['"', '!'], start: 31, end: 33 }
        ]);
    });

    test('locates a token containing a character at specific index', () => {
        const tokens = tokenize('Phil\twon 2nd place in the "race"!');
        let index = findTokenIndex(tokens, 6);
        expect(tokens[index]).toEqual({ kind: 'word', value: 'won', codepoints: ['w', 'o', 'n'], start: 5, end: 8 });
        index = findTokenIndex(tokens, 27);
        expect(tokens[index]).toEqual({ kind: 'word', value: 'race', codepoints: ['r', 'a', 'c', 'e'], start: 27, end: 31 });
        index = findTokenIndex(tokens, 32);
        expect(tokens[index]).toEqual({ kind: 'other', value: '"!', codepoints: ['"', '!'], start: 31, end: 33 });
        index = findTokenIndex(tokens, 999);
        expect(index).toEqual(-1);
    });
});