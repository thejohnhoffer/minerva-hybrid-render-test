import React, { useState } from 'react';
import { HsvColorPicker } from 'react-colorful';
import { DeckView } from './components/deckView.js';

import './styles.css';

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

const imageSource = {
  width: 3500,
  height: 2500,
  tileSize: 1024,
  maxLevel: 2,
  path: 'data/tonsil',
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

function Controls(props) {
  const controls = props.names.map((name, i) => {
    const color = props.colors[i];
    const visible = props.visibles[i];
    const setColor = props.setColor(i);
    const toggleVisible = props.setVisible(i);
    return (
      <ChannelControl {...{ name, color, setColor, visible, toggleVisible }} />
    );
  });
  return <div className='channel-list'>{controls}</div>;
}

function App() {
  const [viewState, setViewState] = useState({ zoom: -2, target: [imageSource.width / 2, imageSource.height / 2, 0]});
  const defaultColors = [
    hue2hsv(240), hue2hsv(0), hue2hsv(40),
    hue2hsv(80), hue2hsv(120), hue2hsv(160),
    hue2hsv(200), hue2hsv(280), hue2hsv(320)
  ];
  const defaultVisible = [
    true, true, true, false, false, true, false, true, false
  ];
  const [colors, setColors] = useState(defaultColors);
  const [visibles, setVisibles] = useState(defaultVisible);
  const setColor = (i) => {
    return (color) => {
      const newColors = [...colors];
      newColors[i] = color;
      setColors(newColors);
    }
  }
  const setVisible = (i) => () => {
    const newVisible = [...visibles];
    newVisible[i] = !newVisible[i];
    setVisibles(newVisible);
  };
  const names = [
    'DNA', 'Ki-67', 'Keratin', 'CD3D', 'CD4',
    'CD45', 'CD8A', 'αSMA', 'CD20'
  ]
  const paths = [
    'DNA_0__DNA', 'Ki-67_1__Ki-67', 'Keratin_2__Keratin',
    'CD3D_3__CD3D', 'CD4_4__CD4', 'CD45_5__CD45',
    'CD8A_6__CD8A', '-SMA_7__-SMA', 'CD20_8__CD20'
  ]
  const channelSources = paths.map((path, i) => {
    const [ color, visible ] = [hsv2gl(colors[i]), visibles[i]];
    return { path, color, visible };
  });
  const deckProps = {
    viewState, imageSource, channelSources
  };
  const controlProps = {
    names, colors, visibles, setColor, setVisible
  }
  return (<>
    <DeckView {...deckProps}/>
    <Controls {...controlProps}/>
  </>);
}

export default App;
