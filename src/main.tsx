import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as api from './api'
import { AlertProvider } from 'flowcloudai-ui'
import { ThemeProvider } from 'flowcloudai-ui'
import "flowcloudai-ui/style";

const result = api.showWindow().then()
result.then(console.log)
result.catch(console.error)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <ThemeProvider defaultTheme={"system"}>
          <AlertProvider>
              <App />
          </AlertProvider>
      </ThemeProvider>
  </StrictMode>,
)