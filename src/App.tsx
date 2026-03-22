import HeroScene, { xrStore } from './HeroScene'
import { AudioProvider, useAudio } from './AudioProvider'
import { MuteButton } from './MuteButton'

function AppContent() {
  const { engine, resume } = useAudio();
  return (
    <div className="app">
      <MuteButton />
      <button
        onClick={() => {
          resume().then(() => {
            if (engine) engine.masterVolume = 0.7;
          }).catch(() => {});
          xrStore.enterVR().catch((e: unknown) => console.error('Enter VR failed:', e));
        }}
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
  );
}

function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  )
}

export default App
