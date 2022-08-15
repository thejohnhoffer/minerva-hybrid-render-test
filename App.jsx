import { PostProcessEffect } from '@deck.gl/core';
import { OrthographicView } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';
import GL from '@luma.gl/constants';
import Deck from 'deck.gl';
import React, { useState } from 'react';
import { HsvColorPicker } from 'react-colorful';

import './styles.css';

function toChannel (id) {
  return {
    "min": 0,
    "max": 1.0,
    "id": id,
    "label": `${id}`,
    "color": "ffffff"
  }
}

function toGroup (id) {
  return {
    "label": `${id}`,
    "channels": [
      toChannel(id),
    ],
    "render": [
      toChannel(id),
    ]
  }
}

function toPreview (filepath, uuid) {
  return {
    "is_autosave": true,
    "waypoints": [
        {
            "name": "",
            "text": "",
            "pan": [
                0.5,
                0.5
            ],
            "zoom": 1,
            "masks": [],
            "arrows": [],
            "overlays": [],
            "group": "a"
        }
    ],
    "groups": [
      toGroup(0),
      toGroup(1),
      toGroup(2),
    ],
    "masks": [],
    "csv_file": ".",
    "root_dir": "",
    "in_file": filepath,
    "out_name": uuid,
    "rotation": 0,
    "header": "",
    "image": {
      "description": ""
    }
  }
} 


var fs = `\
vec4 brightnessContrast_filterColor(vec4 color) {
  color.r = pow(color.r, .5);
  color.g = pow(color.g, .5);
  color.b = pow(color.b, .5);
  return color;
}
vec4 brightnessContrast_filterColor(vec4 color, vec2 texSize, vec2 texCoords) {
  return brightnessContrast_filterColor(color);
}
`
const brightnessContrast = {
  name: 'brightnessContrast',
  uniforms: {},
  fs,
  passes: [{filter: true}]
};

const postProcessEffect = new PostProcessEffect(brightnessContrast, {
  brightness: 1.0,
  contrast: 1.0
});

const toLinearFrag = `
color.r = pow(color.r, 2.);
color.g = pow(color.g, 2.);
color.b = pow(color.b, 2.);
`

class GammaBitmap extends BitmapLayer {
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      'fs:DECKGL_FILTER_COLOR': toLinearFrag
    };
    return shaders;
  }
}

function createTileLayer(meta, subpath, color, visible) {
  const LayerOptions = [
    BitmapLayer,
    GammaBitmap
  ]
  const Layer = LayerOptions[meta.gammaChoice];
  return new TileLayer({
    id: subpath,
    visible: visible,
    tileSize: meta.tileSize,
    minZoom: -meta.maxLevel,
    updateTriggers: {
      getTileData: meta.path
    },
    maxZoom: 0,
    extent: [0, 0, meta.width, meta.height],
    color: color,
    getTileData: ({ x, y, z }) => {
      if (x < 0 || y < 0) return null;
      return load(`${meta.path}/${subpath}/${-z}_${x}_${y}.jpg`, ImageLoader);
    },
    renderSubLayers: (props) => {
      const { left, bottom, right, top } = props.tile.bbox;
      const { x, y, z } = props.tile;
      const color = props.color;
      return new Layer({
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

function ChannelControl(props) {
  const { name, color, setColor, visible, toggleVisible } = props;
  return (
    <>
      <div
        className={'channel-label ' + (visible ? 'enabled' : '')}
        onClick={toggleVisible}
      >
        {name}
      </div>
      <HsvColorPicker color={color} onChange={setColor} />
    </>
  );
}

const UUID = crypto.randomUUID();

function toImageMeta (config, uuid, gammaChoice) {
  const { session } = config;
  if (session == null) {
    return null;
  }
  const iPath = [
    "images",
    "gamma/images"
  ][gammaChoice]
  return {
    ...config,
    gammaChoice,
    path: `http://localhost:2020/story/${session}/${iPath}/${uuid}`,
  };
};

function hsv2gl ({ h, s, v }) {
  h = (h / 360) * 6;
  s = s / 100;
  v = v / 100;
  const hh = Math.floor(h),
        b = v * (1 - s),
        c = v * (1 - (h - hh) * s),
        d = v * (1 - (1 - h + hh) * s),
        module = hh % 6;
  return [
    [v, c, b, b, d, v][module],
    [d, v, v, c, b, b][module],
    [b, b, d, v, v, c][module],
    1,
  ];
};

function hue2hsv(h) {
  return { h: h, s: 100, v: 100};
}

async function importOME(filepath, uuid) {
  const importBody = new FormData();
  const url = "http://localhost:2020/api/import";
  importBody.append("csvpath", "");
  importBody.append("filepath", filepath);
  importBody.append("autosave_logic", "skip");
  importBody.append("dataset", uuid);
  return await fetch(url, {
    method: 'post',
    body: importBody
  })
} 

async function previewOME(s, filepath, uuid) {
  const previewBody = toPreview(filepath, uuid);
  const url = `http://localhost:2020/api/preview/${s}`
  return await fetch(url, {
    body: JSON.stringify(previewBody),
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })
}

function useMinervaAuthor(filepath, uuid, configure) {
  return async function () {
    const res = await importOME(filepath, uuid);
    try {
      const config = await res.json();
      const args = [config.session, filepath, uuid];
      await previewOME(...args);
      configure(config);
    }
    catch (error) {
      console.error(error);
      return null;
    }
  }
}

function App() {
  const [color1, setColor1] = useState(hue2hsv(240));
  const [color2, setColor2] = useState(hue2hsv(0));
  const [color3, setColor3] = useState(hue2hsv(120));
  const defaultFile = "LUNG-3-PR_40X.ome.tif";
  const defaultPath = `/Users/jth30/Downloads/${defaultFile}`;
  const [chans, setChans] = React.useState(['DNA', 'AF488', 'AF555']);
  const [filepath, setFilepath] = React.useState(defaultPath);
  const [visible, setVisible] = useState([true, true, true]);
  const [gammaChoice, setGammaChoice] = useState(0);
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState({
    width: 1024,
    height: 1024,
    tileSize: 1024,
    session: null,
    maxLevel: 1
  })
  const [viewState, setViewState] = useState({
    zoom: -2, target: [512, 512, 0]
  });
  const [layers, setLayers] = useState([]);
  const toggleVisibleI = (i) => () => {
    const newVisible = [...visible];
    newVisible[i] = !newVisible[i];
    setVisible(newVisible);
  };
  const choices = ["Default Gamma", "Proper Gamma"];
  const choiceElements = choices.map((s, i) => {
    const extras = gammaChoice == i ? ['chosen'] : [];
    const cClassName = ['choice', ...extras].join(' ');
    const cProps = {
      onClick: () => setGammaChoice(i),
      className: cClassName,
      key: `choice-${i}`
    }
    return (<div {...cProps}>{s}</div>);
  })
  const configure = (_c) => {
    const newConfig = {
      ...config,
      width: _c.width,
      height: _c.height,
      session: _c.session,
      maxLevel: _c.maxLevel,
      tileSize: _c.tilesize
    }
    setConfig(newConfig);
    const dFileLen = defaultFile.length;
    const filename = filepath.slice(-1*dFileLen);
    if (filename != defaultFile) {
      setChans(_c.channels.slice(0,3));
    }
    const w = newConfig.width;
    const h = newConfig.height;
    const target = [w/2, h/2, 0];
    setViewState({...viewState, target})
  }
  const startAuthor = useMinervaAuthor(filepath, UUID, configure);
  const newPath = (event) => {
    setFilepath(event.target.value);
  }
  const instructions = (
    <>
      <h3>Instructions</h3>
      <ul>
        <li>
          Run Minerva Author (localhost:2020)
        </li>
        <li>
          {"Save "}
          <a href="https://www.synapse.org/#!Synapse:syn17778717">
          example OME-TIFF
          </a>
          {" (~/Downloads)"}
        </li>
      </ul>
      <input type="text" value={filepath} onChange={newPath} />
      <ul>
        <li>
          {"Enter path and "}
          <button onClick={startAuthor}>Open OME-TIFF</button>
        </li>
      </ul>
    </>
  )
  React.useEffect(() => {
    const meta = toImageMeta(config, UUID, gammaChoice);
    if (meta != null) {
      setLayers([
         createTileLayer(meta, '0_0__0', hsv2gl(color1), visible[0]),
         createTileLayer(meta, '1_1__1', hsv2gl(color2), visible[1]),
         createTileLayer(meta, '2_2__2', hsv2gl(color3), visible[2]),
      ])
    }
  }, [color1, color2, color3, visible, gammaChoice, config]);
  const extra = config.session == null ? ['no-nav'] : [];
  const choiceClass = ['two-choices', ...extra].join(' ');
  const channelClass = ['channel-list', ...extra].join(' ');
  const effects = [
    [],
    [postProcessEffect]
  ][gammaChoice] 
  return (
    <>
      <Deck
        layers={layers}
        effects={effects}
        views={[new OrthographicView({ id: 'ortho', controller: true })]}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        controller={true}
      />
      <div className='nav-panel'>
         <div className={choiceClass}>
            {choiceElements}
         </div>
         <div className={channelClass}>
           <ChannelControl name={chans[0]} color={color1} setColor={setColor1} visible={visible[0]} toggleVisible={toggleVisibleI(0)} />
           <ChannelControl name={chans[1]} color={color2} setColor={setColor2} visible={visible[1]} toggleVisible={toggleVisibleI(1)} />
           <ChannelControl name={chans[2]} color={color3} setColor={setColor3} visible={visible[2]} toggleVisible={toggleVisibleI(2)} />
         </div>
        <div className='info'>
          {config.session == null ? instructions : 'Success'}
        </div>
      </div>
    </>
  );
}

export default App;
