import { useEffect, useRef } from 'react';
import fuzzysort from 'fuzzysort';

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

/**
 * @param {string} query - the search query
 * @param {string[] | TranscriptItem[]} items - the items to search
 * @returns {TranscriptItemSearchMatch[]} - transcripts matching the search query
 */
const defaultMatcher = async (query, items) => {
    const wrappedItems = items.map(item => typeof item === 'string' ? { text: item } : item);
    const results = fuzzysort.go(query, wrappedItems, { key: 'text', threshold: -10000 });

    return results.map(match => ({
        item: match.obj,
        score: match.score,
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
        if (!enabled || !query || !transcripts.length) {
            setFilteredTranscripts(transcripts);
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
