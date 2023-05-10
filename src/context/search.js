import { useEffect, useRef } from 'react';
import fuzzysort from 'fuzzysort';
import MiniSearch from 'minisearch';

const wordRegexp = /[\d\p{General_Category=Letter}]/ug;

/**
 * The ._indexes property is not a true array so using directly will result in unexpected, non-deterministic behavior
 * result._indexes.len is some magic value, anything beyond it can be discarded
 * @param {Fuzzysort.Result} result - a fuzzy search result object
 * @returns {number[]} the cleaned indices where matches occurred
 */
export const getIndices = result => result._indexes.slice(0, result._indexes.len);
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
    const tokens = [];
    let currentToken = null;
    let offset = 0;
    let index = 0;
    const codepoints = Array.from(str);
    for (const codepoint of codepoints) {
        if (codepoint.match(wordRegexp)) {
            if (!currentToken || currentToken.kind !== 'word') {
                if (currentToken) tokens.push(currentToken);
                currentToken = { kind: 'word', value: codepoint, index, codepoints: [codepoint], index: index++, start: offset, end: offset + 1 };
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
 * @param {SearchTerms[]} terms - the tokenized search terms
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
                return null;
            }
        } while (acceptedTokens.length !== term.codepoints.length);

        results.push({ term, tokens: acceptedTokens, indices: acceptedIndices });
        cursor += term.codepoints.length;
    }
    return results;
}

/**
 * @param {Fuzzysort.Result} match - a result object from fuzzysort
 * @param {string} query - the search  query string
 */
export const validateMatch = (match, query) => {
    const text = match.target;
    const tokens = tokenize(text);
    const terms = tokenizeSearchTerms(query);
    let indices = getIndices(match);
    const matchedTerms = linkTermsToTokens(indices, tokens, terms);
    if (!matchedTerms) {
        console.log(terms);//tokens);
        throw new Error(`terms invalid\n\tindices:`);//${indices}\n\t${terms}`);
    }

    for (const termMatch of matchedTerms) {
        // console.log(termMatch);
        if (termMatch.tokens.length > 1) { // this is now a split term
            const token0 = termMatch.tokens[0];
            let tIdx = 0;
            let codepoints = 0;
            do {
                const cpIdx = indices.shift();
                const token = termMatch.tokens[tIdx];
                const lastToken = termMatch.tokens[tIdx - 1] ?? null;
                const nextToken = termMatch.tokens[tIdx + 1] ?? null;

                if (token.start > cpIdx || token.end < cpIdx) {
                    if (token.start <= cpIdx) console.log('left');
                    if (token.end < cpIdx) console.log('right');
                    console.log(token, lastToken, nextToken, cpIdx)
                    throw new RangeError('codepoint does not fall within the token`')
                    return false;
                }

                if (token !== nextToken) {
                    if (token === token0 && token.end - 1 !== cpIdx) {
                        // the match did not make it to the end of the first token, reject
                        return false;
                    }
                    tIdx++;

                } else {
                    if (token !== lastToken && token !== token0) {
                        // first codepoint of a new token (not the first token)
                        if (token.start !== cpIdx) {
                            // the match did not start at the beginning of the token, reject
                            return false;
                        } else {
                            // check to ensure there are no word tokens between here and lastToken
                            let priorSibling = tokens[token.index - 1];
                            while (priorSibling) {
                                if (priorSibling.kind === 'word' && priorSibling !== lastToken) {
                                    // there is a word token between here and lastToken, reject
                                    return false;
                                } else {
                                    priorSibling = tokens[priorSibling.index - 1];
                                }

                            }
                        }
                    }
                    codepoints++;
                }
            } while (codepoints < termMatch.term.codepoints.length);
        }
    }
    return true;
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
 * @property {string[]} highlighted - the highlighted text (string at odd indices are matches and will be highlighted)
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
