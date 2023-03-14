import viaWebGL from 'viawebgl';

const makeImage = ({ channel, imageSource }) => {
  const { path, width, height, tileSize, maxLevel } = imageSource;
  return {
    tilesize: tileSize,
    url: path, name: "i0",
    width, height, maxLevel,
    description: "", ext: "jpg",
    path: channel.path,
  };
};

const makeTileSource = (img, idx) => {
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
    channelIndex: idx,
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

const toChannel = ({ idx, channel, imageSource }) => {
  const img = makeImage({ channel, imageSource });
  return {
    loadTilesWithAjax: false,
    crossOriginPolicy: 'anonymous',
    compositeOperation: 'lighter',
    tileSource: makeTileSource(img, idx),
    width: img.width / img.height,
  };
};

const toContext = (viewer, reset, event) => {
  const clear = viewer.removeAllHandlers.bind(viewer);
  const destroy = viewer.destroy.bind(viewer, event);
  const add = viewer.addHandler.bind(viewer, event);
  const { viewport } = viewer;
  const ready = true;
  return {
    destroy, add, clear, viewport, reset, ready
  };
};

const to_tile_shape = ([w, h]) => {
  return new Float32Array([w, h]);
}

const draw_tile = (ctx, output, viaGL, w, h) => {
  const gl_w = viaGL.width;
  const gl_h = viaGL.height;
  ctx.drawImage(output, 0, 0, gl_w, gl_h, 0, 0, w, h);
}

const to_tile_drawing = ({ viaGL, state, uniforms }) => {
  const { u_tile_shape, u_tile_color } = uniforms;
  const { gl } = viaGL;
  return (_, e) => {
    // Read parameters from each tile
    const { source } = e.tiledImage;
    const { channelIndex } = source;
    const w = e.rendered.canvas.width;
    const h = e.rendered.canvas.height;
    // check cache
    state.trackTile(e.tile);
    if (e.tile._cached) {
      draw_tile(e.rendered, e.tile._cached, viaGL, w, h);
      return;
    }
     
    // Load image into array
    e.tile._data = ((e, w, h) => {
      const { tile, rendered } = e;
      if (tile._data) return tile._data;
      return rendered.getImageData(0, 0, w, h).data;
    })(e, w, h);

    // Clear the rendered tile
    e.rendered.fillStyle = "black";
    e.rendered.fillRect(0, 0, w, h);

    // Start webGL rendering
    const output = ((data, w, h) => {
      const color_3fv = state.color_vecs[channelIndex];
      const tile_shape_2fv = to_tile_shape([w, h]);
      gl.uniform2fv(u_tile_shape, tile_shape_2fv);
      gl.uniform3fv(u_tile_color, color_3fv);

      // Send the tile to the texture
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, w, h, 0,
                gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, data);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return gl.canvas;
    })(e.tile._data, w, h);
    // Begin caching current tile 
    if (!e.tile._caching) {
      e.tile._caching = createImageBitmap(output);
      e.tile._caching.then(bitmap => {
        delete e.tile._caching;
        e.tile._cached = bitmap;
      });
    }
    draw_tile(e.rendered, output, viaGL, w, h);
  }
}

const newContext = (state, opts, reset) => {
  const { channelSources, imageSource, config, update } = opts;
  const { tileShape, /*setTileShape*/ } = opts;
  const viewer = viaWebGL.OpenSeadragon({
    immediateRender: true,
    maxZoomPixelRatio: 10,
    visibilityRatio: 0.9,
    showHomeControl: false,
    compositeOperation: 'lighter',
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

  viewer.world.addHandler("add-item", (e) => {
    e.item.setWidth(imageSource.width / imageSource.height);
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
  seaGL["tile-loaded"] = () => null;
  viaGL["gl-loaded"] = function (program) {
    const u_tile_shape = gl.getUniformLocation(program, "u_tile_shape");
    const u_tile_color = gl.getUniformLocation(program, "u_tile_color");
    const uniforms = { u_tile_shape, u_tile_color };
    const closure = { viaGL, state, uniforms }
    seaGL["tile-drawing"] = to_tile_drawing(closure);
  };

  const idxLen = channelSources.length;
  const idxArray = [...Array(idxLen).keys()];
  idxArray.map(idx => {
    const channel = channelSources[idx];
    viewer.addTiledImage(toChannel({ idx, channel, imageSource }));
  });
  viaGL.init().then(seaGL.adder.bind(seaGL));

  const event = "animation-finish";
  const context = toContext(viewer, reset, event);
  const redraw = () => {
    viewer.forceRedraw()
  }

  return { context, redraw };
};

const toSettings = ({ opts, tiles }) => {
  const { channelSources } = opts;
  const color_vecs = channelSources.map(({color}, idx) => {
    return new Float32Array(color.slice(0,3));
  });
  [...tiles.values()].forEach((tile) => {
    delete tile._caching; 
    delete tile._cached; 
  });
  return { color_vecs };
}

class State {

  constructor(opts) {
    this.tiles = new Map();
    this.settings = {};
    this.update(opts);
  }

  get color_vecs () {
    return this.settings.color_vecs;
  }

  trackTile (tile) {
    this.tiles.set(tile.url, tile);
  }

  update (opts) {
    const { tiles } = this;
    const settings = toSettings({ opts, tiles });
    this.settings.color_vecs = settings.color_vecs;
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
    const { context, redraw } = newContext(this.state, opts, reset);
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

export { OpenSeadragonContext };
