# Routes

This frontend uses React Router in a Vite single-page app. Page components live in this directory and route paths are declared in `src/App.tsx`.

The production build is written to `dist/`. A production web server must serve `index.html` for unknown paths so direct links such as `/counterparty/ABC` reach React Router.
