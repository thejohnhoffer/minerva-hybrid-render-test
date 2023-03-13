import viaWebGL from 'viawebgl';

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
    loadTilesWithAjax: false,
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

const to_tile_shape = ([w, h]) => {
  return new Float32Array([w, h]);
}

const newContext = (state, reset) => {
  const { opts, settings } = state;
  const { channelSources, imageSource, config, update } = opts;
  const { tileShape, /*setTileShape*/ } = opts;
  const viewer = viaWebGL.OpenSeadragon({
    immediateRender: true,
    maxZoomPixelRatio: 10,
    visibilityRatio: 0.9,
    showHomeControl: false,
    showNavigationControl: false,
    showFullPageControl: false,
    ...config,
  });
  const seaGL = new viaWebGL.openSeadragonGL(viewer);
  seaGL.viaGL.fShader = "./lib/glsl/fragment.glsl";
  seaGL.viaGL.vShader = "./lib/glsl/vertex.glsl";
  seaGL.viaGL.updateShape(...tileShape);
  const viaGL = seaGL.viaGL;
  const { gl } = viaGL;

  const img = makeImage({ channelSources, imageSource });

  viewer.world.addHandler("add-item", (e) => {
    e.item.setWidth(img.width / img.height);
  });
  viewer.addHandler("tile-drawn", (e) => {
    //let count = _.size(e.tiledImage._tileCache._tilesLoaded);
    //e.tiledImage._tileCache._imagesLoadedCount = count;
    const canvas = e.eventSource.drawer.canvas;
    const context = canvas.getContext("2d");
    context.mozImageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.msImageSmoothingEnabled = false;
    context.imageSmoothingEnabled = false;
  });
  seaGL["tile-loaded"] = (callback, e) => {
    const { source } = e.tiledImage;
    const { tileFormat } = source;
    try {
      e.tile._blobUrl = e.image?.src;
    } catch (err) {
      console.log("Load Error, Refreshing", err, e.tile.url);
      //forceRepaint(); TODO
    }
  };
  seaGL.io["tile-drawing"] = function (e, data, w, h) {
    var gl_w = viaGL.width;
    var gl_h = viaGL.height;

    // Render a webGL canvas to an input canvas
    var output = viaGL.loadArray(data, w, h);
    e.rendered.drawImage(output, 0, 0, gl_w, gl_h, 0, 0, w, h);
  };
  seaGL["tile-drawing"] = async function (callback, e) {
    // Read parameters from each tile
    const { source } = e.tiledImage;
    const { tileFormat } = source;
    const group = e.tile.url.split("/");
    const sub_url = group[group.length - 3];
    var w = e.rendered.canvas.width;
    var h = e.rendered.canvas.height;
    if (e.tile._data === undefined) {
      const { data } = e.rendered.getImageData(0, 0, w, h);
      e.tile._data = data;
    }

    // Clear the rendered tile
    e.rendered.fillStyle = "black";
    e.rendered.fillRect(0, 0, w, h);

    // Start webGL rendering
    callback(e, e.tile._data, w, h);
  }
  //closure
  {
    const _state = {
      activeTileShape: [...tileShape],
    }
    viaGL.loadArray = function (data, w, h) {
      viaGL["gl-drawing"].call(viaGL);
      _state.activeTileShape = [w, h];
      // Send the tile to the texture
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, w, h, 0,
                gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, data);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return gl.canvas;
    };
    viaGL["gl-loaded"] = function (program) {
      const { activeTileShape } = _state;
      const tile_shape_2fv = to_tile_shape(activeTileShape);
      _state.u_tile_shape = gl.getUniformLocation(program, "u_tile_shape");
      _state.u_tile_color = gl.getUniformLocation(program, "u_tile_color");
      gl.uniform2fv(_state.u_tile_shape, tile_shape_2fv);
      gl.uniform3fv(_state.u_tile_color, settings.color_3fv);
    };
    viaGL["gl-drawing"] = function () {
      //const args = this.gl_arguments;
      const { activeTileShape } = _state;
      const { u_tile_shape, u_tile_color } = _state;
      const tile_shape_2fv = to_tile_shape(activeTileShape);
      gl.uniform2fv(u_tile_shape, tile_shape_2fv);
      gl.uniform3fv(u_tile_color, settings.color_3fv);
    };
  }

  addChannels(viewer, img);
  viaGL.init().then(seaGL.adder.bind(seaGL));

  const event = "animation-finish";
  const context = toContext(viewer, reset, event);
  viewer.addHandler(event, () => {
    handle(context, update);
  });
  const redraw = () => {
    viewer.world._needsDraw = true;
  }

  return { context, redraw };
};

const toSettings = (opts) => {
  const { channelSources } = opts;
  const color = channelSources[0].color.slice(0,3);
  const color_3fv = new Float32Array(color);
  return { color_3fv };
}

class State {

  constructor(opts) {
    this.settings = toSettings(opts);
    this.opts = opts;
  }

  get color_3fv () {
    return this.settings.color_3fv;
  }

  update (opts) {
    for (const [k,v] of Object.entries(toSettings(opts))) {
      this.settings[k] = v;
    }
  }
}

class OpenSeadragon {

  constructor(opts) {
    this.state = new State(opts);
    this.reset(opts);
  }

  reset(opts) {
    if (this.context) {
      this.context.destroy();
    }
    const reset = this.reset.bind(this);
    const { context, redraw } = newContext(this.state, reset);
    this.context = context;
    this.redraw = redraw;
    return context;
  }

  updateSettings(opts) {
    this.state.update(opts);
    this.redraw();
  }
}

const OpenSeadragonContext = (opts) => {
  return new OpenSeadragon(opts);
};

export { OpenSeadragonContext, readViewport, makeImage, addChannels, toContext, handle };
