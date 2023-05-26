import React from 'react';
import PropTypes from 'prop-types';

/** @typedef {import('../../../context/search').TranscriptSearchResults} TranscriptSearchResults */

/**
 * @typedef TranscriptSearchProps
 * @property {TranscriptSearchResults} searchResults - the search results
 * @property {(searchQuery: string | null) => void} setSearchQuery - sets the search query
 */

/**
 * @param {TranscriptSearchProps} props
 */
const TranscriptSearch = ({ setSearchQuery, searchResults }) => {
    return (
        <div className="ramp--transcript_search">
            <div className="ramp--transcript_search-input-container">
                <input
                    type="search"
                    className="ramp--transcript_search-input"
                    aria-label="Search the transcript"
                    placeholder="Search Transcript..."
                    onChange={(event) => { console.log('search: ' + event.target.value); setSearchQuery(event.target.value) }}
                />
            </div>
            {searchResults.ids.length > 0 && (
                <div className="ramp--transcript_search-navigator">
                    <button className="ramp--transcript_search-prev" type="button" disabled title="Previous Search Result">Previous</button>
                    <span className="ramp--transcript_search-count">1 of {searchResults.ids.length}</span>
                    <button className="ramp--transcript_search-prev" type="button" title="Next Search Result">Next</button>
                </div>
            )}
        </div>
    );
};

TranscriptSearch.propTypes = {
    setSearchQuery: PropTypes.func.isRequired
};

export default TranscriptSearch;
