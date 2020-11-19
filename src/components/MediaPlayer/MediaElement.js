import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import hlsjs from 'hls.js';
import {
  usePlayerDispatch,
  usePlayerState,
} from '../../context/player-context';
import {
  useManifestDispatch,
  useManifestState,
} from '../../context/manifest-context';
import 'mediaelement';
import '../../mediaelement/javascript/plugins/mejs-quality.js';

// Import stylesheets
import '../../mediaelement/stylesheets/mediaelementplayer.css';
import '../../mediaelement/stylesheets/plugins/mejs-quality.scss';
import '../../mediaelement/stylesheets/mejs-iiif-player-styles.scss';

import {
  createSourceTags,
  createTrackTags,
} from '@Services/mejs-utility-helper';
import { hasNextSection } from '@Services/iiif-parser';

const MediaElement = ({
  controls,
  height,
  id,
  mediaType,
  options,
  poster,
  preload,
  sources,
  tracks,
  width,
  initStartTime,
  canvasIndex,
}) => {
  const playerDispatch = usePlayerDispatch();
  const { isPlaying, startTime } = usePlayerState();
  const manifestDispatch = useManifestDispatch();
  const { manifest } = useManifestState();

  const success = (media, node, instance) => {
    console.log('Loaded successfully');

    // Register ended event
    media.addEventListener('ended', (ended) => {
      if (ended) {
        // Re-set playhead to 0
        playerDispatch({ startTime: 0, type: 'setStartTime' });
        handleEnded();
      }
    });

    // Register caption change event
    media.addEventListener('captionschange', (captions) => {
      console.log('captionschange', captions);
    });

    media.addEventListener('play', () => {
      playerDispatch({ isPlaying: true, type: 'setPlayingStatus' });
      console.log('play event fires');
    });

    media.addEventListener('pause', () => {
      playerDispatch({ isPlaying: false, type: 'setPlayingStatus' });
      console.log('pause event fires');
    });

    media.addEventListener('loadedmetadata', () => {
      console.log('loaded metadata');
      playerDispatch({
        startTime: initStartTime || startTime,
        type: 'setStartTime',
      });
      node.currentTime = initStartTime || startTime;
    });

    if (isPlaying) {
      media.play();
    }
  };

  const error = (media) => {
    console.log('Error loading');
  };

  const handleEnded = () => {
    if (hasNextSection({ canvasIndex, manifest })) {
      manifestDispatch({ canvasIndex: canvasIndex + 1, type: 'switchCanvas' });
    }
  };

  useEffect(() => {
    const { MediaElementPlayer } = global;

    if (!MediaElementPlayer) {
      return;
    }

    /**
     * Create the configuration object for MediaElement.js player
     */
    const meConfigs = Object.assign({}, JSON.parse(options), {
      pluginPath: './static/media/',
      success: (media, node, instance) => success(media, node, instance),
      error: (media, node) => error(media, node),
      features: [
        'playpause',
        'current',
        'progress',
        'duration',
        'volume',
        'quality',
        mediaType === 'video' ? 'tracks' : '',
        'fullscreen',
      ],
      qualityText: 'Stream Quality',
      toggleCaptionsButtonWhenOnlyOne: true,
    });

    window.Hls = hlsjs;

    playerDispatch({
      player: new MediaElementPlayer(id, meConfigs),
      type: 'updatePlayer',
    });
  }, [canvasIndex]);

  const sourceTags = createSourceTags(JSON.parse(sources));
  const tracksTags = createTrackTags(JSON.parse(tracks));

  const mediaBody = `${sourceTags.join('\n')} ${tracksTags.join('\n')}`;
  const mediaHtml =
    mediaType === 'video'
      ? `<video data-testid="video-element" id="${id}" width="${width}" height="${height}"${
          poster ? ` poster=${poster}` : ''
        }
          ${controls ? ' controls' : ''}${
          preload ? ` preload="${preload}"` : ''
        }>
        ${mediaBody}
      </video>`
      : `<audio data-testid="audio-element" id="${id}" width="${width}" ${
          controls ? ' controls' : ''
        }${preload ? ` preload="${preload}"` : ''}>
        ${mediaBody}
      </audio>`;

  return <div dangerouslySetInnerHTML={{ __html: mediaHtml }} />;
};

MediaElement.propTypes = {
  crossorigin: PropTypes.string,
  height: PropTypes.number,
  id: PropTypes.string,
  mediaType: PropTypes.string,
  options: PropTypes.string,
  poster: PropTypes.string,
  preload: PropTypes.string,
  sources: PropTypes.string,
  tracks: PropTypes.string,
  width: PropTypes.number,
  canvasIndex: PropTypes.number,
};

export default MediaElement;
