import { useEffect, useRef } from 'react';
import fuzzysort from 'fuzzysort';
import MiniSearch from 'minisearch';

const wordRegexp = /[\d\p{General_Category=Letter}]/ug;

/**
 * Converts a search query into discrete tokens
 * @param {string} query - the search query
 * @returns {string[]} search tokens, separated by whitespace but ignoring special characters
 */
export const tokenizeSearchQuery = (query) => (tokenize(query)
    .reduce((acc, token, idx, arry) => {
        let result = [...acc];
        if (acc.length) {
            if (token.kind === 'word') {
                result[result.length - 1] = result[result.length - 1] + token.value;
            } else if (token.kind === 'whitespace') {
                result.push(''); // start a new token
            } //else {
            // future tokens will be merged into the current one
            // example: [Blue][@][Green] ===> [BlueGreen]
            // }
        } else if (token.kind === 'word') {
            result.push(token.value);
        }
        if (idx === arry.length - 1 && token.kind === 'whitespace') {
            // remove trailing empty token
            result.pop();
        }
        return result
    }, [])
)


/**
 * @typedef SourceTextToken
 * @property {'word'|'whitespace'|'other'} kind - the kind of token
 * @property {string} value - the text comprising the token
 * @property {string[]} codepoints - the individual codepoints making up the token
 * @property {number} start - the start index of the token (relative to source text)
 * @property {number} end - the end index of the token (relative to source text)
 */

/**
 * Tokenizes a body of text
 * @param {string} str - the string to tokenize
 * @returns {SourceTextToken[]} the tokens in the string
 */
export const tokenize = (str) => {
    const tokens = [];
    let currentToken = null;
    let index = 0;
    const codepoints = Array.from(str);
    for (const codepoint of codepoints) {
        if (codepoint.match(wordRegexp)) {
            if (!currentToken || currentToken.kind !== 'word') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'word', value: codepoint, codepoints: [codepoint], start: index, end: index + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        } else if (codepoint.match(/\s/g)) {
            if (!currentToken || currentToken.kind !== 'whitespace') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'whitespace', value: codepoint, codepoints: [codepoint], start: index, end: index + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        } else {
            if (!currentToken || currentToken.kind !== 'other') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'other', value: codepoint, codepoints: [codepoint], start: index, end: index + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        }
        index++;
    }
    if (currentToken) tokens.push(currentToken);
    return tokens;
}

/**
 * Uses indexes from fuzzysort matches to find the tokens at those indexes
 * @param {SourceTextToken[]} tokens - tokens from the source text
 * @param {number[]} indexes - an array of indexes for the matched characters (from fuzzysort)
 * @returns {SourceTextToken[]} - the tokens at the specified indexes
 */
export const indexesToTokens = (tokens, indexes) => {
    const result = [];
    for (const index of indexes) {
        const tokenIndex = findTokenIndex(tokens, index);
        if (tokenIndex !== -1) {
            result.push(tokens[tokenIndex]);
        } else {
            throw new Error(`Could not find token for index ${index}`);
        }

    }
    return result;
};

/**
 * Uses binary search to find a token which has an index between token.start and token.end
 * @params {Token[]} tokens - the tokens to search
 * @params {number} index - the index to search for
 * @returns {number} the index of the token containing the index, or -1 if not found
 **/
export const findTokenIndex = (tokens, index) => {
    let start = 0;
    let end = tokens.length - 1;
    while (start <= end) {
        const mid = Math.floor((start + end) / 2);
        const token = tokens[mid];
        if (token.start <= index && token.end >= index) return mid;
        if (token.start > index) {
            end = mid - 1;
        } else {
            start = mid + 1;
        }
    }
    return -1;
};


/**
 * @typedef TranscriptItem
 * @property {number} begin - The begin time in seconds
 * @property {number} end - The end time in seconds
 * @property {string} text - The text of the transcript item
 * @property {string} [format] - The id of the transcript item
 */
/**
 * @typedef TranscriptItemSearchMatch
 * @property {TranscriptItem|string} item - the original unmodified transcript item
 * @property {string[]} highlighted - the highlighted text (string at odd indexes are matches and will be highlighted)
 * @property {number} score - score of the match
 */

let searchStore = null;
let lastDataSet = null;
let wrappedItems = null;
/**
 * @param {string} query - the search query
 * @param {string[] | TranscriptItem[]} items - the items to search
 * @returns {TranscriptItemSearchMatch[]} - transcripts matching the search query
 */
const defaultMatcher = async (query, items) => {
    if (lastDataSet !== items || !searchStore) {
        lastDataSet = items;
        searchStore = new MiniSearch({
            fields: ['text'],
            storeFields: ['text'],
            searchOptions: { fuzzy: 0.2 }
        });

        wrappedItems = lastDataSet.map((item, idx) => typeof item === 'string' ? { text: item, id: idx } : { id: idx, ...item });
        searchStore.addAll(wrappedItems);
    }
    const results2 = searchStore.search(query);
    const results = results2.map(({ id, score }) => ({ ...lastDataSet[id], score }));

    console.log(`"${query}" results:`, results2);
    const highlightedResults = fuzzysort.go(query, results, { key: 'text' });
    // if (highlightedResults.length !== results.length) {
    //     console.log('result mismatch');
    console.log('\tresults:', results2);
    console.log('\thighlightedResults:', highlightedResults);
    // }

    return highlightedResults.map((match, i) => ({
        item: match.obj,
        score: match.obj.score,
        highlighted: fuzzysort.highlight(match, s => s)
    }));
};

/**
 * @param {TranscriptItemSearchMatch[]} matches - the matches to sort and filter
 * @returns {TranscriptItemSearchMatch[]} the matches sorted by score
 */
const defaultSorter = (items) => items;

/**
 * @typedef UseFilteredTranscriptParams
 * @property {boolean} enabled - Whether the search is enabled (required because you cannot call hooks conditionally)
 * @property {string | null} query - The search query
 * @property {boolean} [onlyMatches=false] - Whether to only return the matches, if true, results are sorted
 * @property {string[] | TranscriptItem[]} transcripts - The transcripts to search
 * @property {(query: string, items: string[] | TranscriptItem[], abortController: AbortController) => Promise<TranscriptItemSearchMatch[]>} [matcher] - a custom matcher function 
 * @property {undefined | (items: TranscriptItemSearchMatch[]) => TranscriptItemSearchMatch[]} [sorter] - a custom sorter function
 * @property {(items: TranscriptItemSearchMatch[]) => void} setFilteredTranscript - a callback to set the filtered transcript
 */
/**
 * @param {UseFilteredTranscriptParams} params
 * @returns {void}
 */
export function useFilteredTranscripts({
    enabled,
    query,
    transcripts,
    onlyMatches = false,
    sorter,
    setFilteredTranscripts,
    matcher = defaultMatcher
}) {
    const abortControllerRef = useRef(null);
    useEffect(() => {
        if (!transcripts) return;
        if (!enabled || !query || !transcripts.length) {
            setFilteredTranscripts(transcripts.map((t, i) => ({
                item: t,
                score: 0 - i,
                highlighted: [typeof t === 'string' ? t : t.text]
            })));
            return;
        }
        const abortController = new AbortController();
        // abort any existing search operations
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) abortControllerRef.current.abort();
        abortControllerRef.current = abortController;
        (matcher(query, transcripts, abortController)
            .then((unsorted) => {
                if (abortController.abort.aborted) return;
                const matches = sorter ? sorter(unsorted) : unsorted;

                if (onlyMatches) {
                    if (!matches.length) return;
                    else {
                        if (typeof transcripts[0] === 'string') {
                            setFilteredTranscripts(matches.map(match => ({
                                ...match,
                                item: (('start' in item)
                                    ? item
                                    : item.text
                                )
                            })));
                        } else {
                            setFilteredTranscripts(matches);
                        }
                    }
                } else {
                    /** @type {TranscriptItemSearchMatch[]} */
                    const interweaved = [];
                    const matchSet = new Set(matches);
                    for (const transcript of transcripts) {
                        for (const match of matchSet) {
                            if (typeof transcript === 'string') {
                                if (transcript === match.text) {
                                    interweaved.push({
                                        item: transcript,
                                        score: match.score,
                                        highlighted: match
                                    });
                                    matchSet.delete(match);
                                } else {
                                    interweaved.push({
                                        item: transcript,
                                        score: -Infinity,
                                        highlighted: [transcript]
                                    });
                                }
                            } else {
                                if (transcript.text === match.text) {
                                    interweaved.push({
                                        item: transcript.text,
                                        score: match.score,
                                        highlighted: match.highlighted
                                    });
                                    matchSet.delete(match);
                                } else {
                                    interweaved.push({
                                        item: transcript.text,
                                        score: -Infinity,
                                        highlighted: [transcript]
                                    });
                                }
                            }
                        }
                    }
                    console.log('interweaved:', interweaved);
                    setFilteredTranscripts(interweaved);
                }
            })
            .catch(e => {
                console.error('search failed', e, query, transcripts);
            })
        );
    }, [query, enabled, transcripts])
}
