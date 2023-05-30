import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import 'lodash';
import TranscriptSelector from './TranscriptMenu/TranscriptSelector';
import TranscriptSearch from './TranscriptMenu/TranscriptSearch';
import { checkSrcRange, createTimestamp, getMediaFragment } from '@Services/utility-helpers';
import { checkManifestAnnotations, parseTranscriptData } from '@Services/transcript-parser';
import './Transcript.scss';
import { useFilteredTranscripts } from '../..//context/search';

/** @typedef {import('../../context/search').TranscriptSearchResults} TranscriptSearchResults */
/** @typedef {import('../..//context/search').TranscriptItem} TranscriptItem */
/** @typedef {import('../..//context/search').TimedTranscriptItem} TimedTranscriptItem */


const buildSpeakerText = (t, text) => {
  if (t.speaker) {
    return `<u>${t.speaker}:</u> ${text}`;
  } else {
    return text;
  }
};

const highlightTranscriptItem = (t) => (typeof t === 'string'
  ? t
  : ('highlighted' in t
    ? (t.highlighted.map((part, i) => (i % 2 === 0
      ? part
      : `<span class="ramp--transcript_search-match">${part}</span>`
    ))).join('')
    : t.text
  )
);





const Transcript = ({ playerID, transcripts, showDownload: showSelect = true, showSearch = true }) => {
  const [canvasTranscripts, setCanvasTranscripts] = React.useState([]);
  /** @type {[TranscriptItem[], React.Dispatch<React.SetStateAction<TranscriptItem[]>>]} */
  const [transcript, _setTranscript] = React.useState([]);
  /** @type {[TranscriptSearchResults, React.Dispatch<React.SetStateAction<TranscriptSearchResults>>]} */
  const [searchResults, setSearchResults] = React.useState(/** @type {TranscriptSearchResults} */ { results: {}, ids: [], idsScored: [] });
  const [transcriptTitle, setTranscriptTitle] = React.useState('');
  const [transcriptUrl, setTranscriptUrl] = React.useState('');
  const [canvasIndex, _setCanvasIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(null);
  const [errorMsg, setError] = React.useState('');

  let isMouseOver = false;
  // Setup refs to access state information within
  // event handler function
  const isMouseOverRef = useRef(isMouseOver);
  const setIsMouseOver = (state) => {
    isMouseOverRef.current = state;
    isMouseOver = state;
  };

  const isEmptyRef = useRef(false);
  const setIsEmpty = (e) => {
    isEmptyRef.current = e;
  };

  const canvasIndexRef = useRef();
  const setCanvasIndex = (c) => {
    canvasIndexRef.current = c;
    _setCanvasIndex(c);
  };



  // React refs array for each timed text value in the transcript
  /** @type {React.MutableRefObject<Record<string|number, HTMLDivElement>>} */
  const textRefs = useRef({});
  /** @type React.MutableRefObject<HTMLDivElement> */
  const transcriptContainerRef = useRef(null);
  const transcriptRef = useRef(transcript);
  const setTranscript = (t) => {
    const temp = t.map((item, idx) => {
      if (typeof item === 'string') {
        return { text: item, id: idx };
      } else {
        return { ...item, id: idx };
      }
    })
    transcriptRef.current = temp;
    console.log('setting transcript ref', temp);
    _setTranscript(temp);
  };

  const areTranscriptsSplit = useMemo(() => {
    if (transcript.length && typeof transcript[0] === 'string') return false;
    else return true;
  }, [transcript]);
  const areTranscriptsTimed = useMemo(() => {
    if (transcript.length && areTranscriptsSplit) {
      if ('begin' in transcript[0] && typeof transcript[0].begin === 'number') return true;
    } else return false;
  }, [transcripts, areTranscriptsSplit]);

  useFilteredTranscripts({
    enabled: true,
    query: searchQuery,
    setSearchResults,
    transcripts: transcript
  });

  /**
   * @param {HTMLDivElement} textRef 
   */
  const scrollToRef = (textRef) => {
    if (!textRef) return;
    textRef.scrollIntoView({ block: 'center' });
  };

  let timedText = [];

  /** @type {[null|number, React.Dispatch<null|number>]} */
  const [focusedLine, setFocusedLine] = useState(null);
  /** @type {[null|number, React.Dispatch<null|number>]} */
  const [focusedMatchIndex, setFocusedMatchIndex] = useState(null);

  /** @type {{current: number | null}} */
  let lastFocusedLine = useRef(focusedLine);
  useEffect(() => {
    if (focusedLine === null) {
      const nextFocus = searchResults.results[searchResults.ids[0]];
      if (searchResults.ids.length > 0) {
        setFocusedMatchIndex(0);
        setFocusedLine(nextFocus.id);
        const textRef = textRefs.current[focusedLine];
        if (textRef) {
          setTimeout(() => scrollToRef(textRefs.current[nextFocus.id]), 25);
        }
      } else {
        lastFocusedLine.current = null;
        setFocusedMatchIndex(null);
      }
    } else {
      const matchIndex = searchResults.ids.indexOf(focusedLine);
      if (matchIndex !== -1) { // currently focused line is in the new result set, maintain focus on it
        if (focusedLine !== lastFocusedLine.current) {
          const match = searchResults.results[focusedLine];
          const item = /** @type {TranscriptItem} */(match ? match : transcript[focusedLine]);
          const textRef = textRefs.current[focusedLine];
          if (textRef) {
            setTimeout(() => scrollToRef(textRefs.current[item.id]), 25);
          }
          lastFocusedLine.current = focusedLine;
        }
        setFocusedMatchIndex(matchIndex);
      } else {
        const nextFocus = searchResults.results[searchResults.ids[0]];
        if (nextFocus) {
          setFocusedMatchIndex(0);
          setFocusedLine(nextFocus.id);
          const textRef = textRefs.current[focusedLine];
          if (textRef) {
            setTimeout(() => scrollToRef(textRefs.current[nextFocus.id]), 25);
          }
        } else {
          setFocusedLine(null);
          setFocusedMatchIndex(null);
        }
      }
    }
  }, [searchResults, focusedLine, transcript]);

  let player = null;

  useEffect(() => {
    setTimeout(function () {
      const domPlayer = document.getElementById(playerID);
      if (!domPlayer) {
        console.error(
          "Cannot find player, '" +
          playerID +
          "' on page. Transcript synchronization is disabled."
        );
      } else {
        player = domPlayer.children[0];
      }
      if (player) {
        observeCanvasChange(player);
        player.dataset['canvasindex']
          ? setCanvasIndex(player.dataset['canvasindex'])
          : setCanvasIndex(0);
        player.addEventListener('timeupdate', function (e) {
          if (e == null || e.target == null || !areTranscriptsTimed) {
            return;
          }
          const currentTime = e.target.currentTime;

          for (const transcriptLine of /** @type {TimedTranscriptItem[]} */ (transcript)) {
            if (currentTime >= transcriptLine.begin && currentTime <= transcriptLine.end) {
              setFocusedLine(transcriptLine.id);
            }
          }
        });

        player.addEventListener('ended', e => {
          // render next canvas related transcripts
          setCanvasIndex(canvasIndex + 1);
        });
      }
    });
  }, []);

  useEffect(() => {
    // Clean up state on component unmount
    return () => {
      setCanvasTranscripts([]);
      setTranscript([]);
      setTranscriptTitle('');
      setTranscriptUrl('');
      setCanvasIndex();
      player = null;
      isMouseOver = false;
      timedText = [];
    };
  }, []);

  const fetchManifestData = React.useCallback(async (t) => {
    const data = await checkManifestAnnotations(t);
    setCanvasTranscripts(data);
    setStateVar(data[0]);
  }, []);


  useEffect(() => {
    const getCanvasT = tr => tr.filter((t) => t.canvasId == canvasIndex);
    const getTItems = tr => getCanvasT(tr)[0].items;
    /**
     * When transcripts prop is empty
     * OR the respective canvas doesn't have transcript data
     * OR canvas' transcript items list is empty
     */
    if (
      !(transcripts && transcripts.length > 0) ||
      !(getCanvasT(transcripts) && getCanvasT(transcripts).length > 0) ||
      !(getTItems(transcripts) && getTItems(transcripts).length > 0)
    ) {
      setIsLoading(false);
      setIsEmpty(true);
      setTranscript([]);
      setError('No Transcript(s) found, please check again.');
    } else {
      const cTrancripts = getCanvasT(transcripts);
      fetchManifestData(cTrancripts[0]);
      setIsEmpty(false);
    }
  }, [canvasIndex]);

  const observeCanvasChange = () => {
    // Select the node that will be observed for mutations
    const targetNode = player;

    // Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };

    // Callback function to execute when mutations are observed
    const callback = function (mutationsList, observer) {
      // Use traditional 'for loops' for IE 11
      for (const mutation of mutationsList) {
        if (mutation.attributeName?.includes('src')) {
          const p = document.querySelector('video') || document.querySelector('audio');
          if (p) {
            setCanvasIndex(parseInt(p.dataset['canvasindex']));
          }
        }
      }
    };

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
  };

  const selectTranscript = (selectedTitle) => {
    const selectedTranscript = canvasTranscripts.filter(tr => tr.title === selectedTitle);
    setStateVar(selectedTranscript[0]);
  };

  const setStateVar = async (transcript) => {
    if (!transcript) {
      return;
    }

    const { title, url } = transcript;
    setTranscriptTitle(title);

    // parse transcript data and update state variables
    await Promise.resolve(
      parseTranscriptData(url, canvasIndexRef.current)
    ).then(function (value) {
      if (value != null) {
        const { tData, tUrl } = value;
        setTranscriptUrl(tUrl);
        setTranscript(tData);
        tData?.length == 0
          ? setError('No Valid Transcript(s) found, please check again.')
          : null;
      } else {
        setTranscript([]);
        setError('Invalid URL for transcript, please check again.');
      }
      setIsLoading(false);
    });
  };

  /**
   * Playable range in the player
   * @returns {Object}
   */
  const getPlayerDuration = () => {
    const duration = player.duration;
    let timeFragment = getMediaFragment(player.src, duration);
    if (timeFragment == undefined) {
      timeFragment = { start: 0, end: duration };
    }
    return timeFragment;
  };

  /**
   * Update state based on mouse events - hover or not hover
   * @param {Boolean} state flag identifying mouse event
   */
  const handleMouseOver = (state) => {
    setIsMouseOver(state);
  };

  let showOnlyMatches = true;

  if (transcriptRef.current) {
    if (transcripts && transcripts.length > 0) {
      if (typeof transcript[0] == 'string') {
        // when given a word document as a transcript
        timedText.push(
          <div
            key={0}
            data-testid="transcript_docs"
            dangerouslySetInnerHTML={{ __html: highlightTranscriptItem(transcript[0]) }}
          />
        );
      } else if (showOnlyMatches && searchQuery && !focusedLine) {
        if (searchResults.idsScored.length > 0) {
          // console.log(searchResults.ids, searchResults.idsScored);
          searchResults.idsScored.forEach(idx => {
            const match = searchResults.results[idx];
            const item = /** @type {TranscriptItem} */(match.item);
            timedText.push((
              <div
                className={`ramp--transcript_item${idx === focusedLine ? ' active' : ''}`}
                data-testid="transcript_item"
                key={item.id}
                ref={(el) => (textRefs.current[item.id] = el)}
                onClick={e => { e.preventDefault(); e.stopPropagation(); setFocusedLine(item.id) }}
              >
                {item.begin && (
                  <span
                    className="ramp--transcript_time"
                    data-testid="transcript_time"
                  >
                    <a href={'#'}>[{createTimestamp(item.begin, true)}]</a>
                  </span>
                )}

                <span
                  className="ramp--transcript_text"
                  data-testid="transcript_text"
                  dangerouslySetInnerHTML={{ __html: buildSpeakerText(match.item, highlightTranscriptItem(match)) }}
                />
              </div>
            ));
          });
        } else {
          timedText.push(
            <p key="no-transcript" id="no-transcript" data-testid="no-transcript">
              No matches found within transcript.
            </p>
          );
        }
      } else {
        // timed transcripts
        transcript.forEach(t => {
          const match = searchResults.results[t.id];
          const item = /** @type {TranscriptItem} */(match && match.item ? match.item : t);
          timedText.push(
            <div
              className={`ramp--transcript_item${t.id === focusedLine ? ' active' : ''}`}
              data-testid="transcript_item"
              key={t.id}
              ref={(el) => (textRefs.current[t.id] = el)}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setFocusedLine(t.id) }}
            >
              {item.begin && (
                <span
                  className="ramp--transcript_time"
                  data-testid="transcript_time"
                >
                  <a href={'#'}>[{createTimestamp(item.begin, true)}]</a>
                </span>
              )}

              <span
                className="ramp--transcript_text"
                data-testid="transcript_text"
                dangerouslySetInnerHTML={{ __html: buildSpeakerText(item, highlightTranscriptItem(match ? match : t)) }}
              />
            </div>
          );
        });
      }
    } else {
      // console.log('trigger4');
      // invalid transcripts
      timedText.push(
        <p key="no-transcript" id="no-transcript" data-testid="no-transcript">
          {errorMsg}
        </p>
      );
    }
  }
  if (!isLoading) {
    return (
      <div
        className="ramp--transcript_nav"
        data-testid="transcript_nav"
        key={transcriptTitle}
        onMouseOver={() => handleMouseOver(true)}
        onMouseLeave={() => handleMouseOver(false)}
      >
        {!isEmptyRef.current && (
          <div className="ramp--transcript_menu">
            {showSearch && (
              <TranscriptSearch
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                focusedMatchIndex={focusedMatchIndex}
                setFocusedLine={setFocusedLine}
              />
            )}
            {showSelect && (
              <TranscriptSelector
                setTranscript={selectTranscript}
                title={transcriptTitle}
                url={transcriptUrl}
                transcriptData={canvasTranscripts}
                noTranscript={timedText[0]?.key}
              />
            )}
          </div>
        )}
        <div
          className={`transcript_content${transcriptRef.current ? '' : ' static'}`}
          ref={transcriptContainerRef}
        >
          {transcriptRef.current && timedText}
          {transcriptUrl != '' && timedText.length == 0 && (
            <iframe
              className="transcript_viewer"
              data-testid="transcript_viewer"
              src={transcriptUrl}
            ></iframe>
          )}
        </div>
      </div>
    );
  } else {
    return null;
  }
};

Transcript.propTypes = {
  /** `id` attribute of the media player in the DOM */
  playerID: PropTypes.string.isRequired,
  showSelect: PropTypes.bool,
  showSearch: PropTypes.bool,
  /** A list of transcripts for respective canvases in the manifest */
  transcripts: PropTypes.arrayOf(
    PropTypes.shape({
      /** Index of the canvas in manifest, starts with zero */
      canvasId: PropTypes.number.isRequired,
      /** List of title and URI key value pairs for each individual transcript resource */
      items: PropTypes.arrayOf(
        PropTypes.shape({
          title: PropTypes.string,
          url: PropTypes.string,
        })
      ),
    })
  ).isRequired,
};

export default Transcript;
