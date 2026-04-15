import React from 'react'
import ReactDOM from 'react-dom/client'
import RogueUserWatchdog from './RogueUserWatchdog'
import './globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RogueUserWatchdog standalone={true} />
  </React.StrictMode>,
)
