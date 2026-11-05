import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';import './index.css';import './motion.css';import {initMotion} from './motion';import {applyAccent} from './fx';import {startAppearanceSync} from './appearance'
initMotion();applyAccent(localStorage.getItem('ms_accent'));startAppearanceSync()
{if(localStorage.getItem('ms_theme_v2')==='dark')document.documentElement.classList.add('dark')}  /* light ivory by default for everyone; the OS dark setting is ignored */
createRoot(document.getElementById('root')).render(<App/>)
