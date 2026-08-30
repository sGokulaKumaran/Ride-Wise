import { StrictMode } from 'react'              // React's "strict teacher" — catches bugs in dev
import { createRoot } from 'react-dom/client'   // Modern React 18+ DOM mounting
import './index.css'                            // Loads Tailwind + global styles [3]
import App from './App.jsx'                     // The root component

createRoot(document.getElementById('root')).render(  // Find <div id="root"> in index.html
  <StrictMode>                                     
    <App />                                        
  </StrictMode>,
)