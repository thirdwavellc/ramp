import fuzzysort from 'fuzzysort';
import { findTokenIndex, refineMatch, mergeTokens, indicesToTokens, tokenize, getIndices, tokenizeSearchTerms, linkTermsToTokens, validateMatch } from './search';

describe('refinement', () => {
    const fixture = 'However, this bottle was not marked “poison,” so Alice ventured to taste it';
    test('fuzzysort can produce matches that are more fragmented than necessary', () => {
        const query = 'tlewas';
        const match = fuzzysort.single(query, fixture);
        expect(getIndices(match)).toEqual([9, 18, 19, 21, 22, 23]);
    });
    test('get offset for the most truncated match', () => {
        const query = 'tlewas';
        const match = fuzzysort.single(query, fixture);
        const refined = refineMatch(match, query);
        expect(getIndices(match)).toEqual([18, 19, 21, 22, 23]);
    });
})

describe('validation', () => {
    const fixtures = [
        'Her first idea was that she had somehow fallen into the sea, "and in that case I can go back by railway"',
        'The Mouse looked at her rather inquisitively, and seemed to her to wink with one of its little eyes',
        'Just then her head struck against the roof of the hall: in fact she was now more than nine feet high',
        'However, this bottle was not marked “poison,” so Alice ventured to taste it'
    ];

    test('a single term split across two complete tokens with whitespace in between will match', () => {
        const query = 'winkwith';
        const match = fuzzysort.single(query, fixtures[1]);
        expect(getIndices(match)).toEqual([67, 68, 69, 70, 72, 73, 74, 75]);
        expect(validateMatch(match, query)).toEqual(true);
    });
    test('a single term split across two tokens with only head of second token included will match', () => {
        const query = 'struckagain';
        const match = fuzzysort.single(query, fixtures[2]);
        expect(getIndices(match)).toEqual([19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30]);
        expect(validateMatch(match, query)).toEqual(true);
    });
    // test('a single term split across two tokens with only tail of first token included will match', () => {
    //     const query = 'tlewas';
    //     const match = fuzzysort.single(query, fixtures[3]);
    //     expect(getIndices(match)).toEqual([19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30]);
    //     expect(validateMatch(match, query)).toEqual(true);
    // });

    test('less than great matches can be refined', () => {

    });
    test('two whole terms separated by whitespace will match', () => {
        const query = 'somehow fallen';
        const match = fuzzysort.single(query, fixtures[0]);
        expect(getIndices(match)).toEqual([32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]);
        expect(validateMatch(match, query)).toEqual(true);
    });
    test('a single term match at the beginning of a single token', () => {
        const match = fuzzysort.single('rail', fixtures[0]);
        expect(getIndices(match)).toEqual([96, 97, 98, 99]);
        expect(validateMatch(match, 'rail')).toEqual(true);
    });
    test('a single term match at the middle of a single token', () => {
        const match = fuzzysort.single('quisit', fixtures[1]);
        expect(getIndices(match)).toEqual([33, 34, 35, 36, 37, 38]);
        expect(validateMatch(match, 'quisit')).toEqual(true);
    });
    test('a single term match at the end of a single token', () => {
        const match = fuzzysort.single('ruck', fixtures[2]);
        expect(getIndices(match)).toEqual([21, 22, 23, 24]);
        expect(validateMatch(match, 'ruck')).toEqual(true);
    });
});

describe('search', () => {
    const fixtures = [
        'So he rinsed the soap off.',
        'Some children are messy when they drink milk, but not Phil.',
        'The quick brown fox jumps over the lazy dog.',
        'Kevin\'s dog is named Kalvin.'
    ];
    test('translating fuzzysort\'s results to tokens', () => {
        const result = fuzzysort.single('sohe', fixtures[0]);
        const tokens = tokenize(fixtures[0]);

        // its not a true array so we'll test by stringifying
        expect(getIndices(result)).toEqual([0, 1, 3, 4]);
        expect(indicesToTokens(tokens, result._indexes)).toEqual([
            { kind: 'word', value: 'So', codepoints: ['S', 'o'], start: 0, end: 2, index: 0 },
            { kind: 'word', value: 'So', codepoints: ['S', 'o'], start: 0, end: 2, index: 0 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 3, end: 5, index: 2 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 3, end: 5, index: 2 }
        ]);
    });

    test('fuzzysort returns discontinuous matches', () => {
        const result = fuzzysort.single('sohe', fixtures[1]);
        expect(getIndices(result)).toEqual([0, 1, 6, 11]);
    });
    test
    test('associate search terms in middle of a token', () => {
        const tokens = tokenize(fixtures[0]);
        const terms = tokenizeSearchTerms('ins');
        const match = fuzzysort.single('ins', fixtures[0]);
        expect(getIndices(match)).toEqual([7, 8, 9]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toHaveLength(1);
        expect(result[0].tokens).toHaveLength(3);
        expect(mergeTokens(result[0].tokens)[0].value).toEqual('rinsed');
    });
    test('associate search terms at end of a token', () => {
        const tokens = tokenize(fixtures[1]);
        const terms = tokenizeSearchTerms('ssy');
        const match = fuzzysort.single('ssy', fixtures[1]);
        expect(getIndices(match)).toEqual([20, 21, 22]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toHaveLength(1);
        expect(result[0].tokens).toHaveLength(3);
        expect(mergeTokens(result[0].tokens)[0].value).toEqual('messy');
    });
    test('associate search terms at start of a token', () => {
        const tokens = tokenize(fixtures[3]);
        const terms = tokenizeSearchTerms('nam');
        const match = fuzzysort.single('nam', fixtures[3]);
        expect(getIndices(match)).toEqual([15, 16, 17]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toHaveLength(1);
        expect(result[0].tokens).toHaveLength(3);
        expect(mergeTokens(result[0].tokens)[0].value).toEqual('named');
    });
    test('if linkTermsToTokens get put into an infinite loop, it\'ll just return null', () => {
        const tokens = tokenize(fixtures[2]);
        const terms = tokenizeSearchTerms('nam');
        const match = fuzzysort.single('nam', fixtures[3]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toBeNull();
    });
    test('associate search terms with tokens in order', () => {
        const tokens = tokenize(fixtures[0]);
        const terms = tokenizeSearchTerms('the soap');
        const match = fuzzysort.single('the soap', fixtures[0]);
        expect(getIndices(match)).toEqual([13, 14, 15, 16, 17, 18, 19, 20]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toHaveLength(2);
        expect(result[0].tokens.map(t => t.value)).toEqual(['the', 'the', 'the']);
        expect(result[1].tokens.map(t => t.value)).toEqual(['soap', 'soap', 'soap', 'soap']);
    });
    test('associate search terms with tokens out of order', () => {
        const tokens = tokenize(fixtures[1]);
        const terms = tokenizeSearchTerms('not messy');
        const match = fuzzysort.single('not messy', fixtures[1]);
        expect(getIndices(match)).toEqual([50, 51, 52, 18, 19, 20, 21, 22]);
        const result = linkTermsToTokens(match, tokens, terms);

        expect(result).toHaveLength(2);
        expect(result[0].tokens.map(t => t.value)).toEqual(['not', 'not', 'not']);
        expect(result[1].tokens.map(t => t.value)).toEqual(['messy', 'messy', 'messy', 'messy', 'messy']);
    });
    test('associate a single search term split by whitespace', () => {
        const tokens = tokenize(fixtures[2]);
        const terms = tokenizeSearchTerms('quickbro');
        const match = fuzzysort.single('quickbro', fixtures[2]);
        expect(getIndices(match)).toEqual([4, 5, 6, 7, 8, 10, 11, 12]);
        const result = linkTermsToTokens(match, tokens, terms);
        expect(result).toHaveLength(1);
        expect(result[0].term).toEqual(terms[0]);
        expect(result[0].tokens.map(t => t.value)).toEqual(['quick', 'quick', 'quick', 'quick', 'quick', 'brown', 'brown', 'brown']);
    });
    test('associate a single term split by a special characters (ie: non-whitespace, non-word)', () => {
        const tokens = tokenize(fixtures[3]);
        const terms = tokenizeSearchTerms(`kevin's`);
        const match = fuzzysort.single(`kevin's`, fixtures[3]);
        expect(getIndices(match)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        const result = linkTermsToTokens(match, tokens, terms);
        expect(result[0].term).toEqual(terms[0]);
        expect(mergeTokens(result[0].tokens).slice(0, 2)).toEqual([
            tokens[0],
            tokens[2]
        ]);
    });
});

describe('tokenizer', () => {
    test('merge adjacent tokens', () => {
        const str = `Mary's little lamb`;
        const tokens = indicesToTokens(tokenize(str,), (new Array(str.length)).fill(0).map((_, i) => i));
        expect(tokens.map(t => t.value)).toEqual([
            'Mary', 'Mary', 'Mary', 'Mary', '\'', 's', ' ',
            'little', 'little', 'little', 'little', 'little', 'little',
            ' ', 'lamb', 'lamb', 'lamb', 'lamb'
        ])
        const merged = mergeTokens(tokens);
        expect(merged.map(t => t.value)).toEqual(['Mary', '\'', 's', ' ', 'little', ' ', 'lamb']);

    });
    test('tokenize a search query', () => {
        expect(tokenizeSearchTerms('red apple')).toEqual([{
            value: 'red',
            codepoints: ['r', 'e', 'd'],
        }, {
            value: 'apple',
            codepoints: ['a', 'p', 'p', 'l', 'e']
        }]);
        expect(tokenizeSearchTerms(`sarah's automobile`)).toEqual([{
            value: `sarahs`,
            codepoints: ['s', 'a', 'r', 'a', 'h', 's']
        }, {
            value: 'automobile',
            codepoints: ['a', 'u', 't', 'o', 'm', 'o', 'b', 'i', 'l', 'e']
        }]);
        expect(tokenizeSearchTerms('first 2nd next-to-last')).toEqual([{
            value: 'first',
            codepoints: ['f', 'i', 'r', 's', 't']
        }, {
            value: '2nd',
            codepoints: ['2', 'n', 'd']
        }, {
            value: 'nexttolast',
            codepoints: ['n', 'e', 'x', 't', 't', 'o', 'l', 'a', 's', 't']
        }]);
    });
    test('tokenize a simple string', () => {
        const tokens = tokenize('Then he rinsed the soap off.');
        expect(tokens).toEqual([
            { kind: 'word', value: 'Then', codepoints: ['T', 'h', 'e', 'n'], start: 0, end: 4, index: 0 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 4, end: 5, index: 1 },
            { kind: 'word', value: 'he', codepoints: ['h', 'e'], start: 5, end: 7, index: 2 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 7, end: 8, index: 3 },
            { kind: 'word', value: 'rinsed', codepoints: ['r', 'i', 'n', 's', 'e', 'd'], start: 8, end: 14, index: 4 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 14, end: 15, index: 5 },
            { kind: 'word', value: 'the', codepoints: ['t', 'h', 'e'], start: 15, end: 18, index: 6 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 18, end: 19, index: 7 },
            { kind: 'word', value: 'soap', codepoints: ['s', 'o', 'a', 'p'], start: 19, end: 23, index: 8 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 23, end: 24, index: 9 },
            { kind: 'word', value: 'off', codepoints: ['o', 'f', 'f'], start: 24, end: 27, index: 10 },
            { kind: 'other', value: '.', codepoints: ['.'], start: 27, end: 28, index: 11 }
        ]);
    });
    test('tokenize a more complex string', () => {
        const tokens = tokenize('Phil\twon 2nd place in the "race"!');
        expect(tokens).toEqual([
            { kind: 'word', value: 'Phil', codepoints: ['P', 'h', 'i', 'l'], start: 0, end: 4, index: 0 },
            { kind: 'whitespace', value: '\t', codepoints: ['\t'], start: 4, end: 5, index: 1 },
            { kind: 'word', value: 'won', codepoints: ['w', 'o', 'n'], start: 5, end: 8, index: 2 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 8, end: 9, index: 3 },
            { kind: 'word', value: '2nd', codepoints: ['2', 'n', 'd'], start: 9, end: 12, index: 4 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 12, end: 13, index: 5 },
            { kind: 'word', value: 'place', codepoints: ['p', 'l', 'a', 'c', 'e'], start: 13, end: 18, index: 6 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 18, end: 19, index: 7 },
            { kind: 'word', value: 'in', codepoints: ['i', 'n'], start: 19, end: 21, index: 8 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 21, end: 22, index: 9 },
            { kind: 'word', value: 'the', codepoints: ['t', 'h', 'e'], start: 22, end: 25, index: 10 },
            { kind: 'whitespace', value: ' ', codepoints: [' '], start: 25, end: 26, index: 11 },
            { kind: 'other', value: '"', codepoints: ['"'], start: 26, end: 27, index: 12 },
            { kind: 'word', value: 'race', codepoints: ['r', 'a', 'c', 'e'], start: 27, end: 31, index: 13 },
            { kind: 'other', value: '"!', codepoints: ['"', '!'], start: 31, end: 33, index: 14 }
        ]);
    });
    test('locate a token containing a character at specific index', () => {
        const tokens = tokenize('Phil\twon 2nd place in the "race"!');
        let index = findTokenIndex(tokens, 6);
        expect(tokens[index]).toEqual({ kind: 'word', value: 'won', codepoints: ['w', 'o', 'n'], start: 5, end: 8, index: 2 });
        index = findTokenIndex(tokens, 27);
        expect(tokens[index]).toEqual({ kind: 'word', value: 'race', codepoints: ['r', 'a', 'c', 'e'], start: 27, end: 31, index: 13 });
        index = findTokenIndex(tokens, 32);
        expect(tokens[index]).toEqual({ kind: 'other', value: '"!', codepoints: ['"', '!'], start: 31, end: 33, index: 14 });
        index = findTokenIndex(tokens, 999);
        expect(index).toEqual(-1);
    });
});