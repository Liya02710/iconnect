import { useEffect, useState } from "react";

export default function SplashScreen({ onDone }: { onDone?: () => void } = {}) {
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fading pointer-events after 70% of the 2.6s animation (~1.82s)
    const fadeT = setTimeout(() => setFading(true), 1820);
    // Fully hide after the animation completes
    const hideT = setTimeout(() => {
      setHidden(true);
      onDone?.();
    }, 2700);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(hideT);
    };
  }, [onDone]);

  // Remove from DOM entirely once finished so it can never block clicks
  if (hidden) return null;

  return (
    <div className={`splash-screen ${fading ? "is-fading" : ""}`}>
      {/* App name */}
      <h1 className="font-brand splash-name text-6xl font-bold leading-none">
        ICONNECT
      </h1>

      {/* Loading bar */}
      <div className="splash-bar-track">
        <div className="splash-bar-static" />
        <div className="splash-bar-fill" />
      </div>

      {/* Animated dots */}
      <div className="splash-dots">
        <span className="splash-dot" />
        <span className="splash-dot" />
        <span className="splash-dot" />
      </div>

      {/* Tagline */}
      <p className="splash-tagline">Connecting you</p>
    </div>
  );
}
