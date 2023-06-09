import { timeToHHmmss } from '@Services/utility-helpers';
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { throttle } from 'lodash';
import videojs from 'video.js';
import '../styles/VideoJSProgress.scss';
import { PlayerStateContext } from '../../../../context/player-context';

const vjsComponent = videojs.getComponent('Component');
/**
 * @typedef VideoJSPlayer
 * @type {import('video.js').VideoJsPlayer}
 */
/**
 * @typedef VideoJsPlayerOptions
 * @type {import('video.js').VideoJsPlayerOptions}
 */
/**
 * @typedef PlaybackRange
 * @type {Object}
 * @property {number} start - start time of the range
 * @property {number} end - end time of the range
 * @property {number} altStart - not sure
 */
/**
 * @typedef VideoJSProgressOptions
 * @type {Object}
 * @param {VideoJsPlayerOptions} playerOptions - global player options
 * @param {Number} duration - canvas duration
 * @param {PlaybackRange[]} targets - set of start and end times for items in the current canvas
 * @param {Function} nextItemClicked - callback func to trigger state changes in the parent component
 */
/**
 * VideoJS wrapper around progress bar react component
 */
export class VideoJSProgress extends vjsComponent {
  constructor(player, options) {
    super(player, options);
    this.addClass('ramp--progress_wrapper');
    this.setAttribute('data-testid', 'videojs-custom-progressbar');

    this.mount = this.mount.bind(this);
    this.options = options;

    this.player = player;

    /* When player is ready, call method to mount React component */
    player.ready(() => {
      this.mount();
    });

    /* Remove React root when component is destroyed */
    this.on('dispose', () => {
      ReactDOM.unmountComponentAtNode(this.el());
    });
  }

  mount() {
    console.log('el', this.el());
    this.options.setPortal(ReactDOM.createPortal(
      <ProgressBar />,
      this.el()
    ));
  }
}

vjsComponent.registerComponent('VideoJSProgress', VideoJSProgress);

/**
 * @param {Object} params
 * @param {number} params.duration - length of media file
 */
export const MarkerContainer = ({ duration }) => {
  const ctx = useContext(PlayerStateContext);
  return (
    <div className="ramp--marker-container">
      {ctx.searchMarkers.map((marker, i) => (
        <div
          className={`ramp--marker ${marker.class}`}
          key={marker.key ?? i}
          style={{ left: `${(marker.time / duration) * 100}%` }}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            ctx.player.currentTime(marker.time);
          }}
        />
      ))}
    </div>
  )
};

/**
 * @param {Object} props
 * @param {VideoJSPlayer} props.player - videojs player object
 * @param {Function} props.handleTimeUpdate - callback func to update
 * @param {PlaybackRange} props.times - playback range
 * @param {VideoJSProgressOptions} props.options - player options
 */
export const ProgressBar = () => {
  const playerCtx = useContext(PlayerStateContext);

  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(1);
  const player = playerCtx.player;
  const tooltipTextRef = useRef(timeToHHmmss(playerCtx.player.currentTime()));
  const tooltipRef = useRef(null);

  // round to 2 decimal places because otherwise floating point silliness might prevent us from getting a flat 100%
  const leftBlockWidth = Math.floor(((playerCtx.playerRange.start * 100) / duration) * 100) / 100;
  const rightBlockWidth = Math.floor((((duration - playerCtx.playerRange.end) * 100) / duration) * 100) / 100;
  const centerBlockWidth = Math.floor((100 - leftBlockWidth - rightBlockWidth) * 100) / 100;

  /**
   * Set progress and player time when using the input range
   * (progress bar) to seek to a particular time point
   * @param {Object} e onChange event for input range
   */
  const updateProgress = (e) => {
    let time = Number(e.target.value);
    if (time >= playerCtx.playerRange.start && time <= playerCtx.playerRange.end) {
      player.currentTime(time);
      setProgress(time);
    }
  };

  useEffect(() => {
    player.on('timeupdate', () => {
      const curTime = player.currentTime();
      setProgress(curTime);
      // handleTimeUpdate(curTime);
    });
    player.on('loadedmetadata', () => {
      const curTime = player.currentTime();
      setProgress(curTime);
      setDuration(player.duration());
    });
  }, []);

  const containerRef = useRef(null);
  const containerRectRef = useRef(null);
  const [tooltipOffset, setTooltipOffset] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [!!containerRef.current]);

  const onMouseMove = useMemo(() => throttle(e => {
    if (!tooltipRef.current || !containerRef.current || !containerRectRef.current) return;
    const percent = Math.min(1, Math.max(0, (e.clientX - containerRectRef.current.x) / containerRectRef.current.width))
    setTooltipOffset(percent);
  }, 50), []);

  const progressBarPercent = (
    (progress - playerCtx.playerRange.start)
    / (playerCtx.playerRange.end - playerCtx.playerRange.start)
  );

  return (
    <div
      ref={containerRef}
      style={{ [/** @type {any} */('--range-progress')]: progressBarPercent }}
      className="ramp--progress_container"
      onMouseMove={onMouseMove}
    >
      <MarkerContainer duration={duration} />
      <span className="ramp--progress_tooltip" style={{ left: `${tooltipOffset * 100}%` }} ref={tooltipRef}>
        {timeToHHmmss(tooltipOffset * duration)}
      </span>
      <div
        className="ramp--progress_bar ramp--progress_bar--stripes"
        style={{ width: `${leftBlockWidth}%` }}
      />
      <input
        type="range"
        min={playerCtx.playerRange.start}
        max={playerCtx.playerRange.end}
        value={progress}
        step={0.1}
        style={{ width: `${centerBlockWidth}%` }}
        className="ramp--progress_bar slider-range"
        onChange={updateProgress}
      />
      <div
        className="ramp--progress_bar ramp--progress_bar--stripes"
        style={{ width: `${rightBlockWidth}%` }}
      />
    </div>
  );
};

export default VideoJSProgress;