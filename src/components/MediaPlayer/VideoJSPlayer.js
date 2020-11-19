import React, { useState } from 'react';
import PropTypes from 'prop-types';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import hlsjs from 'hls.js';
import 'videojs-markers-plugin/dist/videojs-markers-plugin';
import 'videojs-markers-plugin/dist/videojs.markers.plugin.css';
import {
  usePlayerDispatch,
  usePlayerState,
} from '../../context/player-context';
import {
  useManifestDispatch,
  useManifestState,
} from '../../context/manifest-context';
import { getMediaInfo, hasNextSection } from '@Services/iiif-parser';

function VideoJSPlayer({ isVideo, initStartTime, ...videoJSOptions }) {
  const [localPlayer, setLocalPlayer] = React.useState();
  const playerRef = React.useRef();
  const playerDispatch = usePlayerDispatch();
  const { isClicked, isPlaying, captionOn } = usePlayerState();
  const manifestDispatch = useManifestDispatch();
  const { manifest, canvasIndex } = useManifestState();
  const { startTime, endTime } = usePlayerState();
  const [cIndex, setCIndex] = React.useState(canvasIndex);
  const playerState = usePlayerState();

  const { player } = playerState;

  React.useEffect(() => {
    playerDispatch({
      player: videojs(playerRef.current, {
        ...videoJSOptions,
      }),
      type: 'updatePlayer',
    });
  }, []);

  React.useEffect(() => {
    if (player) {
      console.log('useEffect() [player]', player);

      //player.addChild('BigPlayButton');
      player.on('ready', function () {
        console.log('ready');
        // Initialize markers
        player.markers({
          markerStyle: {
            width: '4px',
            'background-color': 'red',
            'border-radius': 0,
          },
          markers: [],
        });
      });
      player.on('ended', () => {
        console.log('ended');
        handleEnded(player);
      });
      player.on('loadedmetadata', () => {
        console.log('loadedmetadata');
      });
      player.on('pause', () => {
        console.log('pause');
        playerDispatch({ isPlaying: false, type: 'setPlayingStatus' });
      });
      player.on('play', () => {
        console.log('play');
        playerDispatch({ isPlaying: true, type: 'setPlayingStatus' });
      });
    }

    playerDispatch({ player: Player, type: 'updatePlayer' });
    // Clean up player instance on component unmount
    return () => {
      if (player) {
        player.dispose();
      }
    };
  }, [player]);

  React.useEffect(() => {
    if (!player) {
      return;
    }
    console.log('useEffect() [startTime, endTime]', startTime, endTime);
    if (startTime != null) {
      player.currentTime(startTime, playerDispatch({ type: 'resetClick' }));

      // Mark current timefragment
      if (player.markers) {
        player.markers.removeAll();
        player.markers.add([
          { time: startTime, duration: endTime - startTime, text: 'this' },
        ]);
      }
    }
  }, [startTime, endTime]);

  // useEffect(() => {
  //   // if (jsPlayer) {
  //   //   jsPlayer.dispose();
  //   // }
  //   let Player = videojs(playerRef.current, videoJSOptions);

  //   playerDispatch({ player: Player, type: 'updatePlayer' });
  // }, [isClicked, canvasIndex]);

  const handleEnded = (Player) => {
    if (hasNextSection({ canvasIndex, manifest })) {
      console.log(cIndex);
      debugger;

      const { sources, mediaType, error } = getMediaInfo({
        manifest,
        canvasIndex: cIndex + 1,
      });
      Player.src(sources);
      Player.play();

      playerDispatch({ player: Player, type: 'updatePlayer' });
      setCIndex(cIndex + 1);
      manifestDispatch({ canvasIndex: canvasIndex + 1, type: 'switchCanvas' });
    }
  };

  return (
    <div data-vjs-player>
      {isVideo ? (
        <video
          id={`videojs-${canvasIndex}`}
          data-testid="video-element"
          ref={playerRef}
          className="video-js"
        ></video>
      ) : (
        <audio
          id={`videojs-${canvasIndex}`}
          data-testid="audio-element"
          ref={playerRef}
          className="video-js vjs-default-skin"
        ></audio>
      )}
    </div>
  );
}

VideoJSPlayer.propTypes = {};

export default VideoJSPlayer;
