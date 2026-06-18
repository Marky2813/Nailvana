import '@fontsource/hanken-grotesk/800.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Landing } from './Landing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
