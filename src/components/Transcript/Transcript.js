import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import 'lodash';
import TranscriptSelector from './TranscriptMenu/TranscriptSelector';
import TranscriptSearch from './TranscriptMenu/TranscriptSearch';
import { createTimestamp } from '@Services/utility-helpers';
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

/**
 * @param {string} selector - dom selector to poll for 
 * @param {number} [interval] - how often to check the dom
 * @param {number} [timeout] - time after we give up
 * @returns {Promise<Element>} - the dom element we've all been waiting for
 */
const waitForSelector = (selector, interval = 333, timeout = 15000) => {
  let el = document.querySelector(selector);
  if (el) return Promise.resolve(el);
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(timer);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, interval);
  });
}

export const Transcript = ({ playerID, transcripts, showDownload: showSelect = true, showSearch = true, followVideo = true }) => {
  const [canvasTranscripts, setCanvasTranscripts] = React.useState([]);
  /** @type {[TranscriptItem[], React.Dispatch<React.SetStateAction<TranscriptItem[]>>]} */
  const [transcript, _setTranscript] = React.useState([]);
  /** @type {[TranscriptSearchResults, React.Dispatch<React.SetStateAction<TranscriptSearchResults>>]} */
  const [searchResults, setSearchResults] = React.useState(/** @type {TranscriptSearchResults} */ { results: {}, ids: [], idsScored: [] });
  const followingVideo = useRef(followVideo);
  const searchResultsRef = useRef(searchResults);
  searchResultsRef.current = searchResults;


  const [transcriptTitle, setTranscriptTitle] = React.useState('');
  const [transcriptUrl, setTranscriptUrl] = React.useState('');
  const [canvasIndex, _setCanvasIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(null);
  const [errorMsg, setError] = React.useState('');

  const isEmptyRef = useRef(false);
  const setIsEmpty = (e) => {
    isEmptyRef.current = e;
  };

  /** @type {[{ start: number; end: number; } | null, (value: { start: number; end: number; } | null) => void]} */
  const [playbackRange, setPlaybackRange] = useState(null);

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
    if (!t) return [];
    const temp = t.map((item, idx) => {
      if (typeof item === 'string') {
        return { text: item, id: idx };
      } else {
        return { ...item, id: idx };
      }
    });
    transcriptRef.current = temp;
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
  }, [transcript, areTranscriptsSplit]);

  useFilteredTranscripts({
    enabled: true,
    query: searchQuery,
    setSearchResults,
    transcripts: transcript
  });

  /**
   * @param {HTMLDivElement} textRef  - dom node to center on
   */
  const scrollToRef = (textRef) => {
    if (!textRef) return;
    if (!transcriptContainerRef.current) return;
    let parentTopOffset = transcriptContainerRef.current ? transcriptContainerRef.current.offsetTop : 0;
    transcriptContainerRef.current.scrollTop = (
      textRef.offsetTop -
      parentTopOffset -
      transcriptContainerRef.current.clientHeight / 2
    );
  };

  let timedText = [];

  /** @type {[number|null, React.Dispatch<number|null>]} */
  const [focusedLine, setFocusedLine] = useState(null);
  /** @type {[number|null, React.Dispatch<number|null>]} */
  const [focusedMatchIndex, setFocusedMatchIndex] = useState(null);

  /** @type {{current: number | null}} */
  let lastFocusedLine = useRef(focusedLine);
  useEffect(() => {
    /** @type {HTMLDivElement|null} */
    let refToFocus = null;
    if (focusedLine === null) {
      const nextFocus = searchResults.results[searchResults.ids[0]];
      if (searchResults.ids.length > 0) {
        setFocusedLine(nextFocus.id);
        setFocusedMatchIndex(0);
        refToFocus = textRefs.current[nextFocus.id];
      }
    } else { // a line is currently focused
      const matchIndex = searchResults.ids.indexOf(focusedLine);
      if (searchResults.ids.length === 0) {
        if (searchQuery !== null && searchQuery.replace(/\s/g, '') !== '') {
          setFocusedMatchIndex(-1);
          setFocusedLine(0);
        } else {
          setFocusedMatchIndex(-1);
        }
      } else if (matchIndex !== -1) { // currently focused line is in the new result set, maintain focus on it
        if (focusedLine !== lastFocusedLine.current) {
          refToFocus = textRefs.current[focusedLine];
        }
        setFocusedMatchIndex(matchIndex);
        const nextID = searchResults.ids[matchIndex];
        setFocusedLine(nextID);
        refToFocus = textRefs.current[nextID];
      } else if (focusedMatchIndex >= searchResults.ids.length) {
        setFocusedLine(searchResults.ids[searchResults.ids.length - 1]);
        setFocusedMatchIndex(searchResults.ids.length - 1);
        refToFocus = textRefs.current[searchResults.ids[searchResults.ids.length - 1]];
      } else if (searchResults.ids.length > 0) {
        if (focusedMatchIndex === -1) {
          setFocusedMatchIndex(0);
          const nextID = searchResults.ids[0];
          setFocusedLine(nextID);
          refToFocus = textRefs.current[nextID];
        } else if (typeof focusedMatchIndex === 'number') {
          const nextID = searchResults.ids[focusedMatchIndex];
          setFocusedLine(nextID);
          refToFocus = textRefs.current[nextID];
        }
      }
    }
    lastFocusedLine.current = focusedLine;
    if (refToFocus) {
      setTimeout(() => scrollToRef(refToFocus), 200);
    }
  }, [searchResults, focusedLine, transcript, focusedMatchIndex]);


  const withinRange = t => playbackRange && t.begin >= playbackRange.start && t.end <= playbackRange.end;

  /** @type {[null|HTMLVideoElement, React.Dispatch<null|HTMLVideoElement>]} */
  const [player, setPlayer] = useState(null);
  const navigateToLine = (id) => {
    const line = transcript[id];
    if (player && areTranscriptsTimed && line) {
      player.currentTime = line.begin;
    }
    setFocusedLine(id);
  };

  /** @type {React.MutableRefObject<((this: HTMLVideoElement, ev: Event & { target: HTMLVideoElement }) => any)>} */
  const onPlaybackRef = useRef();
  onPlaybackRef.current = e => {
    if (e == null || e.target == null || !areTranscriptsTimed || !followingVideo.current) return;
    const currentTime = e.target.currentTime;

    for (const transcriptLine of /** @type {TimedTranscriptItem[]} */ (transcript)) {
      if (currentTime >= transcriptLine.begin && currentTime <= transcriptLine.end) {
        // console.log(transcriptLine.id, withinRange(transcriptLine.begin), playbackRange, transcriptLine);
        setFocusedLine(transcriptLine.id);
      }
    }
  };

  useEffect(() => {
    (waitForSelector(`#${playerID}`, 333, 15000)
      .then(domPlayer => {
        let playerEl = /** @type {HTMLVideoElement} */ (domPlayer.children[0]);
        setPlayer(playerEl);

        playerEl.dataset['canvasindex']
          ? setCanvasIndex(playerEl.dataset['canvasindex'])
          : setCanvasIndex(0);
        playerEl.addEventListener('timeupdate', function (e) { return onPlaybackRef.current.call(this, e); });

        playerEl.addEventListener('ended', e => {
          // render next canvas related transcripts
          setCanvasIndex(canvasIndex + 1);
        });
        console.log(`duration: ${playerEl.duration}`)

        // let range = getMediaFragment(playerEl.src, playerEl.duration);
        // if (!range) range = { start: 0, end: playerEl.duration };
        // setPlaybackRange(range);


      }).catch(err => {
        console.error(`Cannot find player, ${playerID} on page.Transcript synchronization is disabled.`);
      })
    );
  }, []);


  const fetchManifestData = React.useCallback(async t => {
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
    const callback = (mutationsList) => {
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
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setFocusedLine(t.id);
                navigateToLine(t.id);
              }}
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
        onMouseOver={() => (followingVideo.current = false)}
        onMouseLeave={() => followVideo && (followingVideo.current = true)}
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
