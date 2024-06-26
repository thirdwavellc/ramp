import React from 'react';
import PropTypes from 'prop-types';
import { useManifestDispatch, useManifestState } from '../../context/manifest-context';
import { usePlayerState } from '../../context/player-context';
import { parsePlaylistAnnotations } from '@Services/playlist-parser';
import { canvasesInManifest } from '@Services/iiif-parser';
import { timeToS } from '@Services/utility-helpers';
import CreateMarker from './MarkerUtils/CreateMarker';
import MarkerRow from './MarkerUtils/MarkerRow';
import { useErrorBoundary } from "react-error-boundary";
import './MarkersDisplay.scss';

const MarkersDisplay = ({ showHeading = true, headingText = 'Markers' }) => {
  const { manifest, canvasIndex, playlist } = useManifestState();
  const { player } = usePlayerState();
  const manifestDispatch = useManifestDispatch();

  const { isEditing, hasAnnotationService, annotationServiceId } = playlist;

  const [canvasPlaylistsMarkers, setCanvasPlaylistsMarkers] = React.useState([]);

  const { showBoundary } = useErrorBoundary();

  const canvasIdRef = React.useRef();

  let canvasPlaylistsMarkersRef = React.useRef([]);
  const setCanvasMarkers = (list) => {
    setCanvasPlaylistsMarkers(...list);
    canvasPlaylistsMarkersRef.current = list;
  };

  // Retrieves the CRSF authenticity token when component is embedded in a Rails app.
  const csrfToken = document.getElementsByName('csrf-token')[0]?.content;

  React.useEffect(() => {
    if (manifest) {
      try {
        const playlistMarkers = parsePlaylistAnnotations(manifest);
        manifestDispatch({ markers: playlistMarkers, type: 'setPlaylistMarkers' });
        const canvases = canvasesInManifest(manifest);
        if (canvases != undefined && canvases?.length > 0) {
          canvasIdRef.current = canvases[canvasIndex].canvasId;
        }
      } catch (error) {
        showBoundary(error);
      }
    }
  }, [manifest]);

  React.useEffect(() => {
    if (playlist.markers?.length > 0) {
      let { canvasMarkers } = playlist.markers.filter((m) => m.canvasIndex === canvasIndex)[0];
      setCanvasMarkers(canvasMarkers);
    }

    if (manifest) {
      try {
        const canvases = canvasesInManifest(manifest);
        if (canvases != undefined && canvases?.length > 0) {
          canvasIdRef.current = canvases[canvasIndex].canvasId;
        }
      } catch (error) {
        showBoundary(error);
      }
    }
  }, [canvasIndex, playlist.markers]);

  const handleSubmit = (label, time, id) => {
    // Re-construct markers list for displaying in the player UI
    let editedMarkers = canvasPlaylistsMarkersRef.current.map(m => {
      if (m.id === id) {
        m.value = label;
        m.timeStr = time;
        m.time = timeToS(time);
      }
      return m;
    });
    setCanvasMarkers(editedMarkers);
    manifestDispatch({ updatedMarkers: editedMarkers, type: 'setPlaylistMarkers' });
  };

  const handleDelete = (id) => {
    let remainingMarkers = canvasPlaylistsMarkersRef.current.filter(m => m.id != id);
    // Update markers in state for displaying in the player UI
    setCanvasMarkers(remainingMarkers);
    manifestDispatch({ updatedMarkers: remainingMarkers, type: 'setPlaylistMarkers' });
  };

  const handleMarkerClick = (e) => {
    e.preventDefault();
    const currentTime = parseFloat(e.target.dataset['offset']);
    player.currentTime(currentTime);
  };

  const handleCreate = (newMarker) => {
    setCanvasMarkers([...canvasPlaylistsMarkersRef.current, newMarker]);
    manifestDispatch({ updatedMarkers: canvasPlaylistsMarkersRef.current, type: 'setPlaylistMarkers' });
  };

  const toggleIsEditing = (flag) => {
    manifestDispatch({ isEditing: flag, type: 'setIsEditing' });
  };

  /** Get the current time of the playhead */
  const getCurrentTime = () => {
    if (player) {
      return player.currentTime();
    } else {
      return 0;
    }
  };

  return (
    <div className="ramp--markers-display"
      data-testid="markers-display">
      {showHeading && (
        <div
          className="ramp--markers-display__title"
          data-testid="markers-display-title"
        >
          <h4>{headingText}</h4>
        </div>
      )}
      {hasAnnotationService && (
        <CreateMarker
          newMarkerEndpoint={annotationServiceId}
          canvasId={canvasIdRef.current}
          handleCreate={handleCreate}
          getCurrentTime={getCurrentTime}
          csrfToken={csrfToken}
        />
      )}
      {canvasPlaylistsMarkersRef.current.length > 0 && (
        <table className="ramp--markers-display_table" data-testid="markers-display-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Time</th>
              {hasAnnotationService && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {canvasPlaylistsMarkersRef.current.map((marker, index) => (
              <MarkerRow
                key={index}
                marker={marker}
                handleSubmit={handleSubmit}
                handleMarkerClick={handleMarkerClick}
                handleDelete={handleDelete}
                hasAnnotationService={hasAnnotationService}
                isEditing={isEditing}
                toggleIsEditing={toggleIsEditing}
                csrfToken={csrfToken} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

MarkersDisplay.propTypes = {
  showHeading: PropTypes.bool,
  headingText: PropTypes.string,
};

export default MarkersDisplay;
