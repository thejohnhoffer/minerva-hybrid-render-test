import React, { useState } from 'react';
import { OsdView } from './osdView.js';

const SeaView = (props) => {
  const maxChannels = 8;
  const { imageSource, channelSources } = props;
  const defaultShape = ['',''].map(() => imageSource.tileSize);
  const [ tileShape, setTileShape ] = useState(defaultShape);
  const seaProps = { 
    imageSource, channelSources,
    tileShape, setTileShape
  };
  return <OsdView {...seaProps}/>
}

export { SeaView }
