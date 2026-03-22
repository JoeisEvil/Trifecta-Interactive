import { useState, useEffect, useRef } from 'react';
import { useAudio } from './AudioProvider';

const DEFAULT_VOLUME = 0.7;
const MAX_VOLUME = 1.2;

export function MuteButton({ forceUnmute }: { forceUnmute?: boolean }) {
  const { engine } = useAudio();
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useState(true); // Start muted
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forceUnmute && isMuted) {
      setIsMuted(false);
    }
  }, [forceUnmute, isMuted]);

  useEffect(() => {
    if (engine) {
      engine.masterVolume = isMuted ? 0 : volume;
    }
  }, [engine, isMuted, volume]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) {
          setIsAnimating(true);
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleButtonClick = () => {
    setIsAnimating(true);
    if (!isOpen) {
      // Opening: unmute if muted
      setIsOpen(true);
      if (isMuted) {
        setIsMuted(false);
        // Resume audio context if suspended (required for mobile)
        if (engine?.state === 'suspended') {
          engine.resume();
        }
      }
    } else {
      // Closing: just close, don't mute
      setIsOpen(false);
    }
  };

  const handleAnimationEnd = () => {
    setIsAnimating(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
      // Resume audio context if suspended (required for mobile)
      if (engine?.state === 'suspended') {
        engine.resume();
      }
    }
  };

  // Determine which icon to show
  const getIcon = () => {
    if (isOpen) {
      // X icon when open
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    } else if (isMuted || volume === 0) {
      // Muted speaker icon
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      );
    } else {
      // Unmuted speaker icon with sound waves
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: '5rem',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <style>
        {`
          @keyframes spinIn {
            0% { transform: rotate(0deg) scale(1); opacity: 1; }
            50% { transform: rotate(180deg) scale(0.8); opacity: 0.5; }
            100% { transform: rotate(360deg) scale(1); opacity: 1; }
          }
          .icon-spin {
            animation: spinIn 0.4s ease-out;
          }
        `}
      </style>

      <button
        onClick={handleButtonClick}
        aria-label={isOpen ? 'Close volume control' : 'Open volume control'}
        style={{
          background: 'rgba(30, 30, 30, 0.8)',
          border: 'none',
          outline: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.4s ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(50, 50, 50, 0.9)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(30, 30, 30, 0.8)';
        }}
      >
        <div
          className={isAnimating ? 'icon-spin' : ''}
          onAnimationEnd={handleAnimationEnd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getIcon()}
        </div>
      </button>

      {/* Volume slider dropdown */}
      <div
        style={{
          background: 'rgba(30, 30, 30, 0.4)',
          borderRadius: '24px',
          padding: '0.75rem',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
          maxHeight: isOpen ? '160px' : '0',
          opacity: isOpen ? 1 : 0,
          transition: 'all 0.3s ease-out',
          pointerEvents: isOpen ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <input
          type="range"
          min="0"
          max={MAX_VOLUME}
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            width: '24px',
            height: '80px',
            cursor: 'pointer',
            accentColor: 'rgba(255, 255, 255, 0.5)',
            background: 'transparent',
            opacity: 0.35,
            transition: 'opacity 0.3s ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.65';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.35';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.opacity = '0.65';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.opacity = '0.65';
          }}
        />

        {/* Instant mute button */}
        <button
          onClick={() => {
            setIsMuted(true);
            setIsAnimating(true);
            setIsOpen(false);
          }}
          aria-label="Mute"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            outline: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
