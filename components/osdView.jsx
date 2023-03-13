import * as React from "react";
import {findDOMNode} from "react-dom";
import {useEffect, useRef, useState} from "react";
import {OpenSeadragonContext} from "../lib/openseadragon";
import styled from "styled-components";

const Main = styled.div`
  height: 100%;
`;

const useUpdate = ({setCache}) => {
  return (c) => {
    setCache((_c) => {
      const keys = [...Object.keys(_c)];
      const entries = keys.map((k) => {
        return [k, k in c ? c[k] : _c[k]];
      });
      return Object.fromEntries(entries);
    });
  };
};

const useEl = ({current}) => {
  return findDOMNode(current);
};

const OsdView = (props) => {
  const rootRef = useRef();
  const {channelSources, imageSource} = props;

  const [cache, setCache] = useState({
    context: null,
    redraw: false,
  });
  const [el, setEl] = useState(useEl(rootRef));
  const config = {
    element: el,
  };

  const {context} = cache;
  const update = useUpdate({setCache});
  const opts = {config, imageSource, update, channelSources};
  const firstDraw = !context?.viewport;

  useEffect(() => {
    setEl(useEl(rootRef))
  }, [rootRef.current]);

  /*
  useEffect(() => {
    if (g !== cache.g) {
      update({g, redraw: true});
    }
  }, [g]);
  */

  useEffect(() => {
    if (cache.redraw && el) {
      const next = context.reset(opts);
      update({redraw: false, context: next});
    }
  }, [cache.redraw, el]);

  const els = [el];
  const ready = els.every((el) => el !== null);

  // First draw
  useEffect(() => {
    if (ready && firstDraw) {
      const next = OpenSeadragonContext(opts);
      update({context: next});
    }
  }, [ready, firstDraw]);

  return <Main ref={rootRef}/>;
};

export { OsdView };
