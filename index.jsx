import React from 'react';
import ReactDOM from 'react-dom';
import { createGlobalStyle } from "styled-components";
import App from './App';

const MainStyle = createGlobalStyle`
  #root {
    height: 100%;
  }
`;

ReactDOM.render(
  <React.StrictMode>
    <App />
    <MainStyle />
  </React.StrictMode>,
  document.getElementById('root'),
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
