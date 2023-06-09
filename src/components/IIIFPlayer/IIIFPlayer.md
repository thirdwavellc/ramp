IIIFPlayer component, provides a wrapper consisting of the Context providers containing state management that allows the components to communicate with each other. 

`IIIFPlayer` component accepts the following props;

- `manifestUrl` : URL of a manifest in the wild to be fetched
- `manifest` : local manifest data, `manifest` takes precedence over the `manifestUrl`


Import Ramp components individually and adjust the layout however you want. Play around with the code below.

*Components (like the `MediaPlayer` component, and `StructuredNavigation` component for example here) must be wrapped by the parent `IIIFPlayer` component.*


To import this component from the librayr;
```js static
import { IIIFPlayer } from '@samvera/ramp';
```

```jsx padded
import MediaPlayer from '../MediaPlayer/MediaPlayer';
import Transcript from '../Transcript/Transcript';
import StructuredNavigation from '../StructuredNavigation/StructuredNavigation';
import config from '../../../env.js';
import mockData from '../../json/lunchroom_manners.js';

import './IIIFPlayer.scss';

/**
 * To test your own IIIF Prezi3 manifest in this component, please use the demo site;
 * https://iiif-react-media-player.netlify.app/
 * OR
 * In the code snippet below;
 *  - provide the manifest URL for the 'manifestUrl' prop (IMPORTANT: the manifest should be public)
 *      e.g: manifestUrl="http://example.com/my-manifest.json"
 *  - remove 'manifest={mockData}' line, since local manifest takes precedence over 'manifestUrl'
 **/
<div className="thm-style">
  <IIIFPlayer
    manifestUrl={`${config.url}/manifests/${config.env}/lunchroom_manners.json`}
    manifest={mockData}
  >
    <div className="iiif-player-demo full-width">
      <MediaPlayer enableFileDownload={true} />

      <Transcript
        playerID="iiif-media-player"
        transcripts={[
          {
            canvasId: 0,
            items: [
              {
                // Structured JSON blob fed directly from a server
                title: 'Structured JSON object list',
                url: `${config.url}/manifests/${config.env}/lunchroom_base.json`,
              },
              {
                // WebVTT file fed directly from a server
                title: 'WebVTT Transcript',
                url: `${config.url}/lunchroom_manners/lunchroom_manners.vtt`,
              },
              {
                // Directly feeding a Word document from a server
                title: 'Transcript in MS Word',
                url: `${config.url}/transcript_ms.docx`,
              },
              {
                // External plain text transcript fed through `annotations` prop in a IIIF manifest
                title: 'External text transcript',
                url: `${config.url}/manifests/${config.env}/volleyball-for-boys.json`, // URL of the manifest
              },
              {
                // External WebVTT file fed through `annotations` prop in a IIIF manifest
                title: 'External WebVTT transcript',
                url: `${config.url}/manifests/${config.env}/lunchroom_manners.json`, // URL of the manifest
              },
              {
                // Transcript as multiple annotations, with one annotation for each transcript fragment
                title: 'Multiple annotation transcript',
                url: `${config.url}/manifests/${config.env}/transcript-annotation.json`, // URL of the manifest
              },
              {
                // Annotation without supplementing motivation
                title: 'Invalid transcript',
                url: `${config.url}/manifests/${config.env}/invalid-annotation.json`, // URL of the manifest
              },
            ],
          },
        ]}
      />
    </div>
  </IIIFPlayer>
</div>;
```
