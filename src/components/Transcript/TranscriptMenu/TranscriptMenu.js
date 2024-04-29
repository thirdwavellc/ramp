import React from 'react';
import PropTypes from 'prop-types';
import TranscriptSelector from './TranscriptSelector';
import TranscriptSearch from './TranscriptSearch';
import { TRANSCRIPT_TYPES } from '@Services/transcript-parser';
import './TranscriptMenu.scss';

export const TranscriptMenu = ({
  showSearch,
  setAutoScroll,
  searchQuery = null,
  setSearchQuery,
  searchResults,
  ...selectorProps
}) => {
  const { transcriptInfo } = selectorProps;
  const { tType } = transcriptInfo;
  const [autoScrollChecked, setAutoScrollChecked] = React.useState(true);

  return (
    <div className="ramp--transcript_menu">
      {showSearch && (
        <TranscriptSearch
          searchResults={searchResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
      <TranscriptSelector {...selectorProps} />
      {tType === TRANSCRIPT_TYPES.timedText && (
        <div
          className="ramp--transcript_auto_scroll_check"
          data-testid="transcript-auto-scroll-check"
        >
          <input
            type="checkbox"
            id="auto-scroll-check"
            name="autoscrollcheck"
            aria-checked={autoScrollChecked}
            checked={autoScrollChecked}
            onChange={() => {
              const checkValue = !autoScrollChecked;
              setAutoScrollChecked(checkValue);
              setAutoScroll(checkValue);
            }}
          />
          <label htmlFor="auto-scroll-check">Auto-scroll with media</label>
        </div>
      )}
    </div>
  );
};

export default TranscriptMenu;

TranscriptMenu.propTypes = {
  showSearch: PropTypes.bool,
  setAutoScroll: PropTypes.func.isRequired,
  ...TranscriptSelector.propTypes,
  ...TranscriptMenu.propTypes
};