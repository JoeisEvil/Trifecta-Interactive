import HeroScene from './HeroScene'
import { AudioProvider } from './AudioProvider'
import { MuteButton } from './MuteButton'

function App() {
  return (
    <AudioProvider>
      <div className="app">
        <MuteButton />
        <HeroScene />
        {/* Extra height for scroll testing */}
        <div style={{ height: '200vh', pointerEvents: 'none' }} />
      </div>
    </AudioProvider>
  )
}

export default App
