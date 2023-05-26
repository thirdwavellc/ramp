import React from 'react';
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
  const [transcript, _setTranscript] = React.useState([]);
  /** @type {[TranscriptSearchResults, React.Dispatch<React.SetStateAction<TranscriptSearchResults>>]} */
  const [searchResults, setSearchResults] = React.useState(/** @type {TranscriptSearchResults} */ { results: {}, ids: [] });
  const [transcriptTitle, setTranscriptTitle] = React.useState('');
  const [transcriptUrl, setTranscriptUrl] = React.useState('');
  const [canvasIndex, _setCanvasIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(null);
  const [errorMsg, setError] = React.useState('');

  let isMouseOver = false;
  // Setup refs to access state information within
  // event handler function
  const isMouseOverRef = React.useRef(isMouseOver);
  const setIsMouseOver = (state) => {
    isMouseOverRef.current = state;
    isMouseOver = state;
  };

  const isEmptyRef = React.useRef(false);
  const setIsEmpty = (e) => {
    isEmptyRef.current = e;
  };

  const canvasIndexRef = React.useRef();
  const setCanvasIndex = (c) => {
    canvasIndexRef.current = c;
    _setCanvasIndex(c);
  };

  // React refs array for each timed text value in the transcript
  let textRefs = React.useRef([]);
  /** @type React.MutableRefObject<HTMLDivElement> */
  const transcriptContainerRef = React.useRef();
  const transcriptRef = React.useRef(transcript);
  const setTranscript = (t) => {
    transcriptRef.current = t;
    _setTranscript(t);
  };
  useFilteredTranscripts({
    enabled: true,
    query: searchQuery,
    setSearchResults,
    transcripts: transcript
  })

  let timedText = [];

  let player = null;

  React.useEffect(() => {
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
          if (e == null || e.target == null) {
            return;
          }
          const currentTime = e.target.currentTime;
          textRefs.current.map((tr) => {
            if (tr) {
              const start = tr.getAttribute('starttime');
              const end = tr.getAttribute('endtime');
              if (currentTime >= start && currentTime <= end) {
                !tr.classList.contains('active')
                  ? autoScrollAndHighlight(currentTime, tr)
                  : null;
              } else {
                // remove highlight
                tr.classList.remove('active');
              }
            }
          });
        });

        player.addEventListener('ended', function (e) {
          // render next canvas related transcripts
          setCanvasIndex(canvasIndex + 1);
        });
      }
    });
  });

  React.useEffect(() => {
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


  React.useEffect(() => {
    let getCanvasT = (tr) => {
      return tr.filter((t) => t.canvasId == canvasIndex);
    };
    let getTItems = (tr) => {
      return getCanvasT(tr)[0].items;
    };
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
          const p =
            document.querySelector('video') || document.querySelector('audio');
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
    const selectedTranscript = canvasTranscripts.filter(function (tr) {
      return tr.title === selectedTitle;
    });
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

  const autoScrollAndHighlight = (currentTime, tr) => {
    if (!tr) {
      return;
    }

    // Highlight clicked/current time's transcript text
    let textTopOffset = 0;
    const start = tr.getAttribute('starttime');
    const end = tr.getAttribute('endtime');
    if (!start || !end) {
      return;
    }
    if (currentTime >= start && currentTime <= end) {
      tr.classList.add('active');
      textTopOffset = tr.offsetTop;
    } else {
      tr.classList.remove('active');
    }

    // When using the transcript panel to scroll/select text
    // return without auto scrolling
    if (isMouseOverRef.current) {
      return;
    }

    // Auto scroll the transcript
    let parentTopOffset = transcriptContainerRef.current ? transcriptContainerRef.current.offsetTop : 0;
    // divide by 2 to vertically center the highlighted text
    transcriptContainerRef.current.scrollTop =
      textTopOffset -
      parentTopOffset -
      transcriptContainerRef.current.clientHeight / 2;
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
   * Determine a transcript text line is within playable
   * range
   * @param {Object} ele target element from click event
   * @returns {Boolean}
   */
  const getIsClickable = (ele) => {
    const segmentRange = {
      start: Number(ele.getAttribute('starttime')),
      end: Number(ele.getAttribute('endtime')),
    };
    const playerRange = getPlayerDuration();
    const isInRange = checkSrcRange(segmentRange, playerRange);
    return isInRange;
  };

  /**
   * When clicked on a transcript text seek to the respective
   * timestamp in the player
   * @param {Object} e event for the click
   */
  const handleTranscriptTextClick = (e) => {
    e.preventDefault();

    /**
     * Disregard the click, which uses the commented out lines
     * or reset the player to the start time (the current functionality)
     * when clicked on a transcript line that is out of playable range.
     *  */
    // const parentEle = e.target.parentElement;
    // const isClickable = getIsClickable(parentEle);

    // if (isClickable) {
    if (player) {
      player.currentTime = e.currentTarget.getAttribute('starttime');
    }

    textRefs.current.map((tr) => {
      if (tr && tr.classList.contains('active')) {
        tr.classList.remove('active');
      }
    });
    e.currentTarget.classList.add('active');
    // }
  };

  /**
   * Update state based on mouse events - hover or not hover
   * @param {Boolean} state flag identifying mouse event
   */
  const handleMouseOver = (state) => {
    setIsMouseOver(state);
  };

  let showOnlyMatches = true;

  console.log(searchQuery, transcriptUrl, timedText.length)
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
      } else if (showOnlyMatches && searchQuery) {
        searchResults.ids.forEach((id) => {
          const match = searchResults.results[id];
          const item = /** @type {TranscriptItem} */(match.item);
          timedText.push((
            <div
              className="ramp--transcript_item"
              data-testid="transcript_item"
              key={id}
              ref={(el) => (textRefs.current[id] = el)}
              onClick={handleTranscriptTextClick}
              starttime={item.begin} // set custom attribute: starttime
              endtime={item.end} // set custom attribute: endtime
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
        // timed transcripts
        transcript.forEach((t, index) => {
          console.log(`trigger3 :: ${index}`, t);
          const match = searchResults.results[index];
          const item = /** @type {TranscriptItem} */(match && match.item ? match.item : t);
          timedText.push((
            <div
              className="ramp--transcript_item"
              data-testid="transcript_item"
              key={index}
              ref={(el) => (textRefs.current[index] = el)}
              onClick={handleTranscriptTextClick}
              starttime={item.begin} // set custom attribute: starttime
              endtime={item.end} // set custom attribute: endtime
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
          ));
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
    console.log('trigger5', timedText[0]?.key);
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
            {showSelect && (
              <TranscriptSelector
                setTranscript={selectTranscript}
                title={transcriptTitle}
                url={transcriptUrl}
                transcriptData={canvasTranscripts}
                noTranscript={timedText[0]?.key}
              />
            )}
            {showSearch && (
              <TranscriptSearch setSearchQuery={setSearchQuery} searchResults={searchResults} />
            )}
          </div>
        )}
        <div
          className={`transcript_content ${transcriptRef.current ? '' : 'static'}`}
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
