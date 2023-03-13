import React from 'react';
import Deck from 'deck.gl';
import GL from '@luma.gl/constants';
import { load } from '@loaders.gl/core';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { OrthographicView } from '@deck.gl/core';
import { ImageLoader } from '@loaders.gl/images';

function createTileLayer(meta, subpath, color, visible) {
  return new TileLayer({
    id: subpath,
    visible: visible,
    tileSize: meta.tileSize,
    minZoom: -meta.maxLevel,
    maxZoom: 0,
    extent: [0, 0, meta.width, meta.height],
    color: color,
    getTileData: ({ index }) => {
      const { x, y, z } = index;
      if (x < 0 || y < 0) return null;
      return load(`${meta.path}/${subpath}/${-z}_${x}_${y}.jpg`, ImageLoader);
    },
    renderSubLayers: (props) => {
      const { left, bottom, right, top } = props.tile.bbox;
      const { x, y, z } = props.tile;
      const color = props.color;
      return new BitmapLayer({
        id: `${subpath}-${z}-${x}-${y}`,
        image: props.data,
        bounds: [left, Math.min(bottom, meta.height), Math.min(right, meta.width), top],
        parameters: {
          depthTest: false,
          blend: true,
          blendFunc: [GL.CONSTANT_COLOR, GL.ONE, GL.ONE, GL.ONE],
          blendColor: color,
          blendEquation: GL.FUNC_ADD,
        },
      });
    },
  });
}

const DeckView = (props) => {
  const { viewState } = props;
  const { imageSource, channelSources } = props;
  const layers = channelSources.map(({path, color, visible}) => {
    return createTileLayer(imageSource, path, color, visible);
  });
  return (
    <Deck
      layers={layers}
      views={[new OrthographicView({ id: 'ortho', controller: true })]}
      viewState={viewState}
      onViewStateChange={e => setViewState(e.viewState)}
      controller={true}
    />
  )
}

export { DeckView }
