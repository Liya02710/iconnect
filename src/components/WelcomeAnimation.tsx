import { useEffect, useState } from "react";

type WelcomeAnimationProps = {
  userName?: string;
  onComplete?: () => void;
};

export default function WelcomeAnimation({
  userName = "Alex",
  onComplete,
}: WelcomeAnimationProps) {
  const [phase, setPhase] = useState<"greeting" | "logo" | "done">("greeting");

  useEffect(() => {
    // Phase 1: greeting → logo after 1.4s
    const t1 = setTimeout(() => setPhase("logo"), 1400);
    // Phase 2: logo → done after 2.8s
    const t2 = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center overflow-hidden bg-black"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      {/* Animated gradient orbs in the background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-80 w-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(119,255,51,0.18) 0%, rgba(119,255,51,0) 70%)",
            filter: "blur(40px)",
            animation:
              "orbFloat1 4s ease-in-out infinite, fadeIn 0.8s ease-out 0.2s both",
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 70%)",
            filter: "blur(40px)",
            animation:
              "orbFloat2 5s ease-in-out infinite, fadeIn 0.8s ease-out 0.4s both",
          }}
        />
        <div
          className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(244,114,182,0.12) 0%, rgba(244,114,182,0) 70%)",
            filter: "blur(40px)",
            animation:
              "orbFloat3 6s ease-in-out infinite, fadeIn 0.8s ease-out 0.6s both",
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {phase === "greeting" ? (
          <div style={{ animation: "greetingIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
            <p
              className="text-xs uppercase tracking-[0.4em] text-white/50"
              style={{ animation: "slideUp 0.6s ease-out 0.1s both" }}
            >
              Welcome back
            </p>
            <h1
              className="mt-3 font-display text-5xl font-bold text-white sm:text-6xl"
              style={{
                animation: "slideUp 0.7s ease-out 0.2s both",
                letterSpacing: "-0.02em",
              }}
            >
              Hello,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #77ff33 0%, #5cd91f 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {userName}
              </span>
            </h1>
            <p
              className="mt-4 text-sm text-white/60"
              style={{ animation: "slideUp 0.6s ease-out 0.4s both" }}
            >
              Let's get your day started
            </p>
            {/* Animated dots */}
            <div
              className="mt-6 flex justify-center gap-1.5"
              style={{ animation: "slideUp 0.6s ease-out 0.5s both" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#77ff33",
                  animation: "bounce 1.2s ease-in-out infinite",
                }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#77ff33",
                  animation: "bounce 1.2s ease-in-out 0.2s infinite",
                }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#77ff33",
                  animation: "bounce 1.2s ease-in-out 0.4s infinite",
                }}
              />
            </div>
          </div>
        ) : (
          // Phase 2: Logo
          <div style={{ animation: "logoIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
            <div
              className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(119,255,51,0.2) 0%, rgba(119,255,51,0.05) 100%)",
                border: "1px solid rgba(119,255,51,0.3)",
                boxShadow: "0 0 40px rgba(119,255,51,0.3)",
                animation: "pulseGlow 2s ease-in-out infinite",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#77ff33"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10"
              >
                <path d="M3 11.5 12 4l9 7.5" />
                <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
              </svg>
            </div>
            <h1
              className="font-brand text-6xl font-bold leading-none"
              style={{
                color: "#77ff33",
                textShadow: "0 0 30px rgba(119,255,51,0.4)",
                animation: "pulseGlow 2s ease-in-out infinite",
              }}
            >
              ICONNECT
            </h1>
            <p
              className="mt-4 text-[10px] uppercase tracking-[0.4em] text-white/50"
              style={{ animation: "slideUp 0.5s ease-out 0.3s both" }}
            >
              Your digital wallet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Particle =====
function Particle({ index }: { index: number }) {
  // Deterministic but spread out values
  const left = (index * 37) % 100;
  const top = (index * 53) % 100;
  const size = 2 + (index % 3);
  const delay = (index * 0.2) % 3;
  const duration = 4 + (index % 3);
  const isBrand = index % 3 === 0;

  return (
    <span
      className="absolute rounded-full"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size,
        background: isBrand ? "#77ff33" : "rgba(255,255,255,0.4)",
        boxShadow: isBrand ? "0 0 6px #77ff33" : "none",
        opacity: 0,
        animation: `particleFloat ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}
