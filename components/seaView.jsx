import React, { useState } from 'react';
import { OsdView } from './osdView.js';

const selectTexture = (gl, texture, idx) => {
  if (texture === undefined) {
    throw new TypeError(`Cannot bind undefined to texture ${idx}.`);
  }
  // Set texture for GLSL
  gl.activeTexture(gl["TEXTURE" + idx]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Assign texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
}

const setFloatTexture = (gl, idx, texture, values, width, height) => {
  this.selectTexture(gl, texture, idx);
  const pixels = this.packFloat32(values, width, height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, pixels);
}

const SeaView = (props) => {
  const maxChannels = 8;
  const { imageSource, channelSources } = props;
  const defaultShape = ['',''].map(() => imageSource.tileSize);
  const [ tileShape, setTileShape ] = useState(defaultShape);
  const tileTextureKeys = [...Array(maxChannels).keys()];
  const seaProps = { 
    imageSource, channelSources,
    tileShape, setTileShape
  };
  return <OsdView {...seaProps}/>
}

export { SeaView }
