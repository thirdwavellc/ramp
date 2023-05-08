import React from 'react';


const TranscriptSelector = (props) => {
    return (
        <div className="ramp--transcript_search">
            <div className="ramp--transcript_search-input-container">
                <input className="ramp--transcript_search-input" type="search" aria-label="Search the transcript" placeholder="Search Transcript..." />
            </div>
            <div className="ramp--transcript_search-navigator">
                <button className="ramp--transcript_search-prev" href="#" disabled alt="Previous Search Result">Previous</button>
                <span className="ramp--transcript_search-count">1 of 7</span>
                <button className="ramp--transcript_search-prev" href="#" alt="Next Search Result">Next</button>
            </div>
        </div>
    );
};

export default TranscriptSelector;
