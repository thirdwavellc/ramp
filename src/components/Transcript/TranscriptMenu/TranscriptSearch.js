import React from 'react';
import PropTypes from 'prop-types';


/**
 * @typedef TranscriptSearchProps
 * @property {(searchQuery: string | null) => void} setSearchQuery - sets the search query
 */

/**
 * @param {TranscriptSearchProps} props
 */
const TranscriptSearch = ({ setSearchQuery }) => {
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
            <div className="ramp--transcript_search-navigator">
                <button className="ramp--transcript_search-prev" href="#" disabled alt="Previous Search Result">Previous</button>
                <span className="ramp--transcript_search-count">1 of 7</span>
                <button className="ramp--transcript_search-prev" href="#" alt="Next Search Result">Next</button>
            </div>
        </div>
    );
};

TranscriptSearch.propTypes = {
    setSearchQuery: PropTypes.func.isRequired
};

export default TranscriptSearch;
