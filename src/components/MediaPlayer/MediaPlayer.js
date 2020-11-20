import React, { useEffect, useState } from 'react';
import MediaElement from '@Components/MediaPlayer/MediaElement';
import VideoJSPlayer from '@Components/MediaPlayer/VideoJSPlayer';
import ErrorMessage from '@Components/ErrorMessage/ErrorMessage';
import { getMediaInfo, getTracks, getStartTime } from '@Services/iiif-parser';
import {
  useManifestDispatch,
  useManifestState,
} from '../../context/manifest-context';
import {
  usePlayerState,
  usePlayerDispatch,
} from '../../context/player-context';

const MediaPlayer = () => {
  const manifestState = useManifestState();
  const { canvasIndex, manifest } = manifestState;
  const { player, startTime } = usePlayerState();
  const manifestDispatch = useManifestDispatch();

  const [ready, setReady] = useState(false);
  const [sources, setSources] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [sourceType, setSourceType] = useState('audio');
  const [error, setError] = useState(null);
  const [cIndex, setCIndex] = useState(canvasIndex);

  useEffect(() => {
    if (cIndex !== canvasIndex || manifest) {
      initCanvas(canvasIndex);
    }
  }, [manifest, canvasIndex]); // Re-run the effect when manifest/canvasIndex changes

  if (error) {
    return <ErrorMessage message={error} />;
  }

  const handleEnded = (oldPlayer) => {
    const { mediaType, sources } = initCanvas(canvasIndex + 1);
    // When source type (audio/video) changes reset existing player
    if (sourceType !== mediaType) {
      oldPlayer.reset();
    } else {
      player.src(sources);
      player.load();
      player.play();
    }

    manifestDispatch({ canvasIndex: cIndex + 1, type: 'switchCanvas' });
  };

  const initCanvas = (canvasId) => {
    const { sources, mediaType, error } = getMediaInfo({
      manifest,
      canvasIndex: canvasId,
    });
    setTracks(getTracks({ manifest }));
    setSources(sources);
    setSourceType(mediaType);
    setError(error);
    setCIndex(canvasId);
    error ? setReady(false) : setReady(true);
    return { mediaType, sources };
  };

  const videoJsOptions = {
    autoplay: false,
    controls: true,
    controlBar: {
      // Define and order control bar controls
      // See https://docs.videojs.com/tutorial-components.html for options of what
      // seem to be supported controls
      children: [
        'playToggle',
        'currentTimeDisplay',
        'timeDivider',
        'remainingTimeDisplay',
        'volumePanel',
        'progressControl',
        'fullscreenToggle',
      ],
      // Options for controls
      volumePanel: {
        inline: false,
      },
    },
    width: 800,
    height: 500,
    sources,
  };

  return ready ? (
    <div data-testid="media-player">
      <VideoJSPlayer
        isVideo={sourceType === 'video'}
        handleIsEnded={handleEnded}
        initStartTime={startTime}
        {...videoJsOptions}
      />
    </div>
  ) : // <div data-testid="media-player" id="media-player">
  //   <MediaElement
  //     controls
  //     crossorigin="anonymous"
  //     height={manifest.height || 360}
  //     id="avln-mediaelement-component"
  //     mediaType={mediaType}
  //     options={JSON.stringify({})}
  //     poster=""
  //     preload="auto"
  //     sources={JSON.stringify(sources)}
  //     tracks={JSON.stringify(tracks)}
  //     width={manifest.width || 480}
  //     startTime={startTime}
  //   />
  // </div>
  null;
};

MediaPlayer.propTypes = {};

export default MediaPlayer;
