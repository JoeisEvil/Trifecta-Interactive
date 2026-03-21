import HeroScene, { xrStore } from './HeroScene'
import { AudioProvider } from './AudioProvider'
import { MuteButton } from './MuteButton'

function App() {
  return (
    <AudioProvider>
      <div className="app">
        <MuteButton />
        <button
          onClick={() => xrStore.enterVR()}
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#fff',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          Enter VR
        </button>
        <HeroScene />
      </div>
    </AudioProvider>
  )
}

export default App
