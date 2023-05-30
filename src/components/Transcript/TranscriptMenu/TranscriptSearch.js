import React from 'react';
import PropTypes from 'prop-types';

/** @typedef {import('../../../context/search').TranscriptSearchResults} TranscriptSearchResults */

/**
 * @typedef TranscriptSearchProps
 * @property {TranscriptSearchResults} searchResults - the search results
 * @property {number} focusedMatchIndex - the index of the focused match
 * @property {(index: number) => void} setFocusedLine - sets the focused line
 * @property {(searchQuery: string | null) => void} setSearchQuery - sets the search query
 */

/**
 * @param {TranscriptSearchProps} props
 */
const TranscriptSearch = ({ setSearchQuery, searchResults, setFocusedLine, focusedMatchIndex }) => {
    return (
        <div className="ramp--transcript_search">
            <div className="ramp--transcript_search-input-container">
                <input
                    type="search"
                    className="ramp--transcript_search-input"
                    aria-label="Search the transcript"
                    placeholder="Search Transcript..."
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                    }}
                />
            </div>
            {searchResults.ids.length > 0 && focusedMatchIndex !== null && (
                <div className="ramp--transcript_search-navigator">
                    <button
                        className="ramp--transcript_search-prev"
                        type="button"
                        disabled={focusedMatchIndex === 0}
                        title="Previous Search Result"
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            // console.log(`matchIdx: ${focusedMatchIndex} // prev id (unscored): ${searchResults.ids[focusedMatchIndex - 1]} // prev id (scored): ${searchResults.idsScored[focusedMatchIndex - 1]}`)
                            setFocusedLine(searchResults.ids[focusedMatchIndex - 1]);
                        }}
                    >
                        Previous
                    </button>
                    <span className="ramp--transcript_search-count">{focusedMatchIndex + 1} of {searchResults.ids.length}</span>
                    <button
                        className="ramp--transcript_search-prev"
                        type="button"
                        disabled={focusedMatchIndex === searchResults.ids.length - 1}
                        title="Next Search Result"
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log({
                                text: `matchIdx: ${focusedMatchIndex} focusId: ${searchResults.ids[focusedMatchIndex]} next focusId: ${searchResults.ids[focusedMatchIndex + 1]}`,
                                current: searchResults.results[searchResults.ids[focusedMatchIndex]],
                                next: searchResults.results[searchResults.ids[focusedMatchIndex + 1]],
                            });
                            // console.log(`matchIdx: ${focusedMatchIndex} // next id (unscored): ${searchResults.ids[focusedMatchIndex + 1]} // next id (scored): ${searchResults.idsScored[focusedMatchIndex + 1]}`)
                            setFocusedLine(searchResults.ids[focusedMatchIndex + 1]);
                        }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

TranscriptSearch.propTypes = {
    setSearchQuery: PropTypes.func.isRequired
};

export default TranscriptSearch;
