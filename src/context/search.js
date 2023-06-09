import { useEffect, useRef } from 'react';
import fuzzysort from 'fuzzysort';

const wordRegexp = /[\d\p{General_Category=Letter}]/ug;

/**
 * @typedef PseudoMatch
 * @property {number} score - the score of the match (-Infinity to 0, 0 being a perfect match)
 * @property {string} target - the full text being matched
 * @property {number[]} indices - indices the matched codepoints
 * @property {any} [obj] - the original object being tested
 */

/** 
 * The ._indexes property is not a true array so using directly will result in unexpected, non-deterministic behavior
 * result._indexes.len is some magic value, anything beyond it can be discarded
 * @param {Fuzzysort.Result|any} result - a fuzzy search result object
 * @returns {number[]} the cleaned indices where matches occurred
 */
export const getIndices = result => [...('indices' in result ? result.indices : result._indexes.slice(0, result._indexes.len))];
/**
 * @typedef SearchTerm
 * @property {string} value - the text of the search term
 * @property {string[]} codepoints - the individual characters comprising the search term
 */

/**
 * Converts a search query into discrete tokens (referred to as SearchTerms)
 * @param {string} query - the search query
 * @returns {SearchTerm[]} search tokens, separated by whitespace but ignoring special characters
 */
export const tokenizeSearchTerms = (query) => (tokenize(query)
    .reduce((acc, token, idx, arry) => {
        let result = [...acc];
        if (acc.length) {
            if (token.kind === 'word') {
                result[result.length - 1].value = result[result.length - 1].value + token.value;
                result[result.length - 1].codepoints = [...result[result.length - 1].codepoints, ...token.codepoints];

            } else if (token.kind === 'whitespace') {
                result.push({
                    value: '',
                    codepoints: []
                }); // start a new token
            } //else {
            // future tokens will be merged into the current one
            // example: [Blue][@][Green] ===> [BlueGreen]
            // }
        } else if (token.kind === 'word') {
            result.push({
                value: token.value,
                codepoints: [...token.codepoints]
            });
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
 * @property {number} start - the start offset of the token (relative to source text)
 * @property {number} end - the end offset of the token (relative to source text)
 * @property {number} index - index of the token in the source text
 */

/**
 * Tokenizes a body of text
 * @param {string} str - the string to tokenize
 * @returns {SourceTextToken[]} the tokens in the string
 */
export const tokenize = (str) => {
    /** @type {SourceTextToken[]} */
    const tokens = [];
    /** @type {SourceTextToken|null} */
    let currentToken = null;
    let offset = 0;
    let index = 0;
    const codepoints = Array.from(str);
    for (const codepoint of codepoints) {
        if (codepoint.match(wordRegexp)) {
            if (!currentToken || currentToken.kind !== 'word') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'word', value: codepoint, codepoints: [codepoint], index: index++, start: offset, end: offset + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        } else if (codepoint.match(/\s/g)) {
            if (!currentToken || currentToken.kind !== 'whitespace') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'whitespace', value: codepoint, codepoints: [codepoint], index: index++, start: offset, end: offset + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        } else {
            if (!currentToken || currentToken.kind !== 'other') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'other', value: codepoint, codepoints: [codepoint], index: index++, start: offset, end: offset + 1 };
            } else {
                currentToken.value = currentToken.value + codepoint;
                currentToken.codepoints.push(codepoint);
                currentToken.end++;
            }
        }
        offset++;
    }
    if (currentToken) tokens.push(currentToken);
    return tokens;
}

/**
 * Merges adjacent tokens which are (referentially) identical
 * @param {SourceTextToken[]} tokens - the unmerged tokens
 * @returns {SourceTextToken[]} the merged tokens
 */
export const mergeTokens = (tokens) => {
    let current = null;
    let result = [];
    for (const token of tokens) {
        if (current !== token) {
            current = token;
            result.push(token);
        }
    }
    return result;
}

/**
 * Uses indices from fuzzysort matches to find the tokens at those indices
 * @param {SourceTextToken[]} tokens - tokens from the source text
 * @param {number[]} indices - an array of indices for the matched characters (from fuzzysort)
 * @returns {SourceTextToken[]} - the tokens at the specified indices
 */
export const indicesToTokens = (tokens, indices) => {
    const result = [];
    for (const index of indices) {
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
        if (token.start <= index && token.end > index) return mid;
        if (token.start > index) {
            end = mid - 1;
        } else {
            start = mid + 1;
        }
    }
    return -1;
};


/**
 * @typedef SearchTermMatch
 * @property {SearchTerm} term - the search term which was matched
 * @property {SourceTextToken[]} tokens - the tokens which were matched (duplicates for each codepoint in a term)
 * @property {number[]} indices - the indices of the matched codepoints
 */
/**
 * @param {Fuzzysort.Result|number[]} match - a result object from fuzzysort or an array of indices where matches occurred
 * @param {SourceTextToken[]} tokens - the tokens from the source text
 * @param {SearchTerm[]} terms - the tokenized search terms
 * @returns {SearchTermMatch[]} 
 */
export const linkTermsToTokens = (match, tokens, terms) => {
    const results = [];
    const indices = Array.isArray(match) ? match : getIndices(match);

    let cursor = 0;
    for (const term of terms) {
        let acceptedTokens = [];
        let acceptedIndices = [];
        let offset = 0;
        do {
            let sliced = indices.slice(cursor + acceptedTokens.length + offset, cursor + offset + term.codepoints.length)
            let termTokens = indicesToTokens(tokens, sliced);
            for (let t = 0; t < termTokens.length; t++) {
                if (termTokens[t].kind === 'word') {
                    acceptedTokens.push(termTokens[t]);
                    acceptedIndices.push(sliced[t]);
                } else {
                    offset++;
                    break;
                }
            }
            if (termTokens.length === 0) {
                // return null;
            }
        } while (acceptedTokens.length !== term.codepoints.length);

        results.push({ term, tokens: acceptedTokens, indices: acceptedIndices });
        cursor += term.codepoints.length;
    }
    return results;
}

const areContiguous = (indices) => {
    for (let i = 0; i < indices.length - 1; i++) {
        if (indices[i] + 1 !== indices[i + 1]) return false;
    }
    return true;
};

/**
 * Fuzzysort has the tendency to return unnecessarily disjointed matches.
 * 
 * For example when searching for "tle" against this string:
 * ```
 *   "However, this bottle was not marked “poison,” so Alice ventured to taste it"
 * ```
 * Fuzzysort will may (but not always) return a match like this:
 * ```
 *   "However, [t]his bott[le] was not marked “poison,” so Alice ventured to taste it"
 * ```
 * That's not as good of a match as this:
 * ```
 *  "However, this bot[tle] was not marked “poison,” so Alice ventured to taste it"
 * ```
 * This function basically reruns the search until it gets matches that are as contiguous
 * as possible by discarding the all characters up until the first matching index and attempting
 * to rematch.
 * 
 * @param {Fuzzysort.Result} match - the fuzzysort result to match
 * @param {string} query - the search query
 * @returns {PseudoMatch} the indices of the refined matched along with the score
 */
export const refineMatch = (match, query) => {
    const target = match.target;
    let offset = 0;
    let result = match;
    while (true) {
        const indices = getIndices(result);
        if (areContiguous(indices)) break;
        const start = indices.shift() + 1;
        const truncatedText = result.target.slice(start);
        const truncatedResult = fuzzysort.single(query, truncatedText);
        if (truncatedResult) {
            offset += start;
            result = truncatedResult;
        } else {
            break;
        }
    }
    return {
        target,
        obj: (/** @type {Fuzzysort.KeyResult<any>} */(match)).obj,
        indices: getIndices(result).map(i => i + offset),
        score: result.score
    };
}

/**
 * Takes a PseudoMatch an returns an array of tokens with the matched codepoints highlighted
 * Strings at odd indices are highlighted, strings at even indices are not
 * @param {PseudoMatch} match - the refined match object
 * @returns {string[]} the highlighted text
 */
export const highlight = (match) => {
    const results = [];
    const codepoints = Array.from(match.target);
    if (match.indices.length === 0) return [match.target];
    const indices = [...match.indices].sort((a, b) => a - b); // copy so we don't mutate
    let offset = 0;
    while (offset < codepoints.length) {
        const index = indices.shift();
        if (index === undefined) {
            results.push(codepoints.slice(offset));
            break;
        }
        const nonMatching = codepoints.slice(offset, index);
        const match = codepoints.slice(index, index + 1);
        if (index !== 0 && offset === index) { // continue adjacent matched codepoint
            results[results.length - 1].push(...match);
        } else {
            results.push(nonMatching);
            results.push(match);
        }
        offset = index + 1;
    }

    return results.map(chunk => chunk.join(''));
};

/**
 * @param {Fuzzysort.Result|PseudoMatch} match - a result object from fuzzysort
 * @param {string} query - the search  query string
 */
export const validateMatch = (match, query) => {
    const text = match.target;
    const tokens = tokenize(text);
    const terms = tokenizeSearchTerms(query);
    let indices = getIndices(match);
    const matchedTerms = linkTermsToTokens(indices, tokens, terms);
    if (!matchedTerms) {
        // console.log(terms);//tokens);
        throw new Error(`terms invalid\n\tindices ${indices.join(',')}\n\t${terms}`);
    }

    for (const termMatch of matchedTerms) {
        // console.log(termMatch);
        if (termMatch.tokens.length > 1) { // this is now a split term
            const token0 = termMatch.tokens[0];
            let cpIdx = 0;
            do {
                const absoluteOffset = indices.shift();
                const token = termMatch.tokens[cpIdx];
                const prevToken = termMatch.tokens[cpIdx - 1] ?? null;
                const nextToken = termMatch.tokens[cpIdx + 1] ?? null;

                if (token.start > absoluteOffset) continue;

                // if (token.end < cpIdx) {
                //     if (token.start <= cpIdx) console.log('left');
                //     if (token.end < cpIdx) console.log('right');
                //     console.log(token, lastToken, nextToken, cpIdx)
                //     throw new RangeError('codepoint does not fall within the token`')
                //     return false;
                // }

                if (token !== nextToken) {
                    if (token === token0 && nextToken && token.end - 1 !== absoluteOffset) {
                        // the match did not make it to the end of the first token, and there are still more tokens to match, reject
                        return false;
                    }
                }
                if (token !== prevToken && token !== token0 && nextToken) {
                    // first codepoint of a new token (not the first token)
                    if (token.start !== absoluteOffset) {
                        // the match did not start at the beginning of the token, reject
                        return false;
                    } else {
                        // check to ensure there are no tokens between here and lastToken
                        let priorSibling = tokens[token.index - 1];
                        while (priorSibling) {
                            if (priorSibling.kind === 'word' && priorSibling !== prevToken) {
                                // there is a word token between here and lastToken, reject
                                return false;
                            } else {
                                priorSibling = tokens[priorSibling.index - 1];
                                if (priorSibling === prevToken) break;
                            }

                        }
                    }
                }
                cpIdx++;
            } while (cpIdx < termMatch.term.codepoints.length);
        }
    }
    return true;
};


/**
 * @typedef TranscriptItem
 * @property {number} id - The id (index) of the transcript item (for transcripts split into lines)
 * @property {number} [begin] - The begin time in seconds
 * @property {number} [end] - The end time in seconds
 * @property {string} text - The text of the transcript item
 * @property {string} [format] - The id of the transcript item
*/
/**
 * @typedef TimedTranscriptItem
 * @property {number} id - The id (index) of the transcript item (for transcripts split into lines)
 * @property {number} begin - The begin time in seconds
 * @property {number} end - The end time in seconds
 * @property {string} text - The text of the transcript item
 * @property {string} [format] - The id of the transcript item
 */
/**
 * @typedef TranscriptItemSearchMatch
 * @property {TranscriptItem|string} item - the original unmodified transcript item
 * @property {string[]} highlighted - the highlighted text (string at odd indices are matches and will be highlighted)
 * @property {number} score - score of the match
 * @property {number} id - the id of the transcript item 
 */

let searchStore = null;
let lastDataSet = null;
let wrappedItems = null;
/**
 * @param {string} query - the search query
 * @param {string[] | TranscriptItem[]} items - the items to search
 * @returns {TranscriptItemSearchMatch[]} - transcripts matching the search query
 */
const defaultMatcher = (query, items) => {
    const wrapped = items.map((item, idx) => (
        (typeof item === 'string'
            ? { text: item, id: idx }
            : { id: idx, ...item }
        )
    ));
    const rawResults = fuzzysort.go(query, wrapped, { key: 'text' }).map(result => refineMatch(result, query));
    const validatedResults = rawResults.filter(result => result && validateMatch(result, query));
    return validatedResults.map((/** @type {any} */match) => ({
        item: match.obj,
        id: match.obj.id,
        score: match.obj.score,
        highlighted: highlight(match)
    }));
};



/**
 * @param {TranscriptItemSearchMatch[]} items - the matches to sort and filter
 * @returns {TranscriptItemSearchMatch[]} the matches sorted by score
 */
const defaultSorter = (items) => items;

/**
 * @typedef TranscriptSearchResults
 * @property {Record<number, TranscriptItemSearchMatch>} results - all matching search results mapped by id
 * @property {number[]} idsScored - the ids (indexes) of the matching search results, sorted by score
 * @property {number[]} ids - the ids (indexes) of the matching search results, chronologically
 */

/**
 * @typedef UseFilteredTranscriptParams
 * @property {boolean} enabled - Whether the search is enabled (required because you cannot call hooks conditionally)
 * @property {string | null} query - The search query
 * @property {string[] | TranscriptItem[]} transcripts - The transcripts to search
 * @property {(query: string, items: string[] | TranscriptItem[], abortController: AbortController) => TranscriptItemSearchMatch[] | Promise<TranscriptItemSearchMatch[]>} [matcher] - a custom matcher function 
 * @property {undefined | ((items: TranscriptItemSearchMatch[]) => TranscriptItemSearchMatch[])} [sorter] - a custom sorter function
 * @property {(searchResults: TranscriptSearchResults) => void} setSearchResults - a callback to set the filtered transcript
 */
/**
 * @param {UseFilteredTranscriptParams} params
 * @returns {void}
 */
export function useFilteredTranscripts({
    enabled,
    query,
    transcripts,
    sorter,
    setSearchResults,
    matcher = defaultMatcher
}) {
    const abortControllerRef = useRef(null);
    useEffect(() => {
        if (!transcripts) return;
        if (!enabled || !query || !transcripts.length) {
            setSearchResults({ results: {}, ids: [], idsScored: [] });
            return;
        }
        const abortController = new AbortController();
        // abort any existing search operations
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) abortControllerRef.current.abort();
        abortControllerRef.current = abortController;
        (Promise.resolve(matcher(query, transcripts, abortController))
            .then((unsorted) => {
                if (abortController.signal.aborted) return;
                const matches = sorter ? sorter(unsorted) : unsorted;


                if (matches.length) {
                    setSearchResults({
                        results: matches.reduce((acc, match) => ({
                            ...acc,
                            [match.id]: match
                        }), {}),
                        idsScored: matches.map(match => match.id),
                        ids: matches.map(match => match.id).sort((a, b) => a - b)
                    });
                } else {
                    setSearchResults({
                        results: {},
                        ids: [],
                        idsScored: []
                    });
                }
            })
            .catch(e => {
                console.error('search failed', e, query, transcripts);
            })
        );
    }, [query, enabled, transcripts])
}
