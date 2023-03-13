import OSD from "openseadragon";

const makeImage = ({ channelSources, imageSource }) => {
  const { path, width, height, tileSize, maxLevel } = imageSource;
  const channel = channelSources[0];
  return {
    tilesize: tileSize,
    url: path, name: "i0",
    width, height, maxLevel,
    description: "", ext: "jpg",
    path: channel.path,
  };
};

const makeTileSource = (img) => {
  const { url, path, ext } = img;

  const getTileName = (x, y, level) => {
    return `${path}/${level}_${x}_${y}.${ext}`;
  };

  const getTileUrl = function (l, x, y) {
    const level = img.maxLevel - l;

    const name = getTileName(x, y, level);
    return `${url}/${name}`;
  };

  return {
    // Custom functions
    getTileUrl: getTileUrl,
    // Standard parameters
    tileHeight: img.tilesize,
    tileWidth: img.tilesize,
    width: img.width,
    height: img.height,
    maxLevel: img.maxLevel,
    minLevel: 0,
  };
};

const addChannels = (viewer, img) => {
  viewer.addTiledImage({
    crossOriginPolicy: 'anonymous',
    tileSource: makeTileSource(img),
    width: img.width / img.height,
  });
};

const readViewport = ({ viewport }) => {
  const { x, y } = viewport.getCenter();
  return [viewport.getZoom(), x, y];
};

const toContext = (viewer, reset, event) => {
  const clear = viewer.removeAllHandlers.bind(viewer);
  const destroy = viewer.destroy.bind(viewer, event);
  const add = viewer.addHandler.bind(viewer, event);
  const { viewport } = viewer;
  const ready = true;
  return {
    destroy,
    add,
    clear,
    viewport,
    reset,
    ready,
  };
};

// FIXME
const handle = (context, update) => {
  // context.clear();
  // context.add(() => {
  //   update({ context });
  // });
};

const newContext = (opts, reset) => {
  const { channelSources, imageSource, config, update } = opts;
  const viewer = OSD({
    immediateRender: true,
    maxZoomPixelRatio: 10,
    visibilityRatio: 0.9,
    showHomeControl: false,
    showNavigationControl: false,
    showFullPageControl: false,
    ...config,
  });
  const img = makeImage({ channelSources, imageSource });

  addChannels(viewer, img);
  viewer.world.addHandler("add-item", (e) => {
    e.item.setWidth(img.width / img.height);
  });

  const event = "animation-finish";
  const context = toContext(viewer, reset, event);
  viewer.addHandler(event, () => {
    handle(context, update);
  });

  return context;
};

class OpenSeadragon {

  constructor(opts) {
    this.reset(opts);
  }

  reset(opts) {
    if (this.context) {
      this.context.destroy();
    }
    const reset = this.reset.bind(this);
    const context = newContext(opts, reset);
    this.context = context;
    return context;
  }
}

const OpenSeadragonContext = (opts) => {
  return new OpenSeadragon(opts).context;
};

export { OpenSeadragonContext, readViewport, makeImage, addChannels, toContext, handle };
