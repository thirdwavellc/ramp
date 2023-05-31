import React, { useRef } from 'react';
import PropTypes from 'prop-types';

/** @typedef {import('../../../context/search').TranscriptSearchResults} TranscriptSearchResults */

/**
 * @typedef TranscriptSearchProps
 * @property {string | null} searchQuery - the search query
 * @property {TranscriptSearchResults} searchResults - the search results
 * @property {number} focusedMatchIndex - the index of the focused match
 * @property {(index: number) => void} setFocusedLine - sets the focused line
 * @property {(searchQuery: string | null) => void} setSearchQuery - sets the search query
 */


/**
 * @param {TranscriptSearchProps} props
 */
const TranscriptSearch = ({ setSearchQuery, searchQuery, searchResults, setFocusedLine, focusedMatchIndex }) => {
    const searchInputRef = useRef(null);
    let resultNavigation = null;
    if (searchQuery !== null && searchQuery.replace(/\s/g, '') !== '') {
        if (searchResults.ids.length === 0) {
            resultNavigation = (
                <div className="ramp--transcript_search-navigator">
                    <span className="ramp--transcript_search-count">no results found</span>
                </div>
            );
        } else {
            if (focusedMatchIndex !== null) {
                resultNavigation = (
                    <div className="ramp--transcript_search-navigator">
                        <button
                            className="ramp--transcript_search-prev"
                            type="button"
                            disabled={focusedMatchIndex === 0}
                            title="Previous Search Result"
                            onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFocusedLine(searchResults.ids[focusedMatchIndex - 1]);
                            }}
                        >
                            Previous
                        </button>
                        <span className="ramp--transcript_search-count">{focusedMatchIndex + 1} of {searchResults.ids.length}</span>
                        <button
                            className="ramp--transcript_search-next"
                            type="button"
                            disabled={focusedMatchIndex === searchResults.ids.length - 1}
                            title="Next Search Result"
                            onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFocusedLine(searchResults.ids[focusedMatchIndex + 1]);
                            }}
                        >
                            Next
                        </button>
                    </div>
                );
            }
        }
    }
    return (
        <div className="ramp--transcript_search">
            <div className="ramp--transcript_search-input-container">
                <input
                    type="text"
                    ref={searchInputRef}
                    className="ramp--transcript_search-input"
                    aria-label="Search the transcript"
                    placeholder="Search Transcript..."
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                    }}
                />
                <button
                    type="button"
                    className="ramp--transcript_search-clear"
                    onClick={() => {
                        setSearchQuery(null);
                        if (searchInputRef.current) searchInputRef.current.value = '';
                    }}
                    disabled={searchQuery === null || searchQuery.replace(/\s/g, '') === ''}
                >{searchQuery !== null ? 'clear' : ''}</button>
            </div>
            {resultNavigation}
        </div>
    );
};

TranscriptSearch.propTypes = {
    setSearchQuery: PropTypes.func.isRequired,
    searchQuery: PropTypes.string,
    searchResults: PropTypes.any,
    setFocusedLine: PropTypes.func.isRequired,
    focusedMatchIndex: PropTypes.number
};

export default TranscriptSearch;

