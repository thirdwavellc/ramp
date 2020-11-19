import React, { useEffect, useState } from 'react';
import MediaElement from '@Components/MediaPlayer/MediaElement';
import VideoJSPlayer from '@Components/MediaPlayer/VideoJSPlayer';
import ErrorMessage from '@Components/ErrorMessage/ErrorMessage';
import { getMediaInfo, getTracks, getStartTime } from '@Services/iiif-parser';
import { useManifestState } from '../../context/manifest-context';
import {
  usePlayerState,
  usePlayerDispatch,
} from '../../context/player-context';

const MediaPlayer = () => {
  const manifestState = useManifestState();
  const { canvasIndex, manifest } = manifestState;
  const { isClicked, player, startTime } = usePlayerState();
  const dispatch = usePlayerDispatch();

  const [ready, setReady] = useState(false);
  const [sources, setSources] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [mediaType, setMediaType] = useState('audio');
  const [initStartTime, setInitStartTime] = useState();
  const [error, setError] = useState(null);
  const [cIndex, setCIndex] = useState(canvasIndex);

  useEffect(() => {
    if ((cIndex !== canvasIndex && isClicked) || manifest) {
      const { sources, mediaType, error } = getMediaInfo({
        manifest,
        canvasIndex,
      });
      setTracks(getTracks({ manifest }));
      setSources(sources);
      setMediaType(mediaType);
      setError(error);
      setInitStartTime(manifest.start ? getStartTime(manifest) : null);
      setCIndex(canvasIndex);
      error ? setReady(false) : setReady(true);
    }
  }, [manifest, canvasIndex]); // Re-run the effect when manifest/canvasIndex changes

  useEffect(() => {
    if (player) {
      player.currentTime(startTime, dispatch({ type: 'resetClick' }));
    }
  }, [startTime]);

  if (error) {
    return <ErrorMessage message={error} />;
  }

  const videoJsOptions = {
    autoplay: true,
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
        isVideo={mediaType === 'video'}
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
