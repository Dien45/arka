import { useState, useEffect, useCallback } from 'react'

function FloatingEmoji({ emoji, delay, left }: { emoji: string; delay: number; left: number }) {
  return (
    <div
      className="absolute text-4xl animate-float pointer-events-none select-none"
      style={{
        left: `${left}%`,
        animationDelay: `${delay}s`,
        top: '-50px',
      }}
    >
      {emoji}
    </div>
  )
}

function Ripple({ x, y, id }: { x: number; y: number; id: number }) {
  return (
    <div
      key={id}
      className="absolute w-4 h-4 rounded-full border-2 border-purple-400 animate-ripple pointer-events-none"
      style={{ left: x - 8, top: y - 8 }}
    />
  )
}

const greetings = [
  'Oy! 👋',
  'Hey there! 🎉',
  'Yo! ✌️',
  'Hola! 🌮',
  'Bonjour! 🥐',
  'Ciao! 🍕',
  'Aloha! 🌺',
  'Namaste! 🙏',
  'Konnichiwa! 🎌',
  'G\'day! 🦘',
  'Zdravstvuyte! 🪆',
  'Salaam! 🕊️',
]

const emojis = ['✨', '🎈', '🌟', '💫', '🎊', '🦋', '🌈', '💜', '🔥', '⚡', '🎵', '🍀']

export default function App() {
  const [clickCount, setClickCount] = useState(0)
  const [greeting, setGreeting] = useState(greetings[0])
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [bgHue, setBgHue] = useState(250)
  const [particles, setParticles] = useState<{ emoji: string; delay: number; left: number; id: number }[]>([])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setRipples(prev => [...prev, { x, y, id: Date.now() }])
    setTimeout(() => {
      setRipples(prev => prev.slice(1))
    }, 1000)

    setClickCount(prev => prev + 1)
    const nextGreeting = greetings[(clickCount + 1) % greetings.length]
    setGreeting(nextGreeting)
    setIsAnimating(true)
    setBgHue((bgHue + 30) % 360)

    // Add floating emojis
    const newParticles = Array.from({ length: 5 }, (_, i) => ({
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      delay: i * 0.2,
      left: Math.random() * 80 + 10,
      id: Date.now() + i,
    }))
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
    }, 3000)

    setTimeout(() => setIsAnimating(false), 300)
  }, [clickCount, bgHue])

  useEffect(() => {
    // Clean up old ripples
    const interval = setInterval(() => {
      setRipples(prev => prev.length > 10 ? prev.slice(-5) : prev)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-700"
      style={{
        background: `linear-gradient(135deg, hsl(${bgHue}, 70%, 15%) 0%, hsl(${(bgHue + 40) % 360}, 60%, 10%) 50%, hsl(${(bgHue + 80) % 360}, 50%, 20%) 100%)`,
      }}
      onClick={handleClick}
    >
      {/* Ambient floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Click ripples */}
      {ripples.map(ripple => (
        <Ripple key={ripple.id} {...ripple} />
      ))}

      {/* Floating emojis on click */}
      {particles.map(p => (
        <FloatingEmoji key={p.id} {...p} />
      ))}

      {/* Main content */}
      <div className="relative z-10 text-center px-4">
        <h1
          className={`text-7xl md:text-9xl font-black mb-8 transition-all duration-300 ${
            isAnimating ? 'scale-125 rotate-3' : 'scale-100 rotate-0'
          }`}
          style={{
            background: `linear-gradient(135deg, hsl(${bgHue}, 100%, 70%), hsl(${(bgHue + 60) % 360}, 100%, 80%))`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            filter: `drop-shadow(0 0 30px hsla(${bgHue}, 100%, 70%, 0.5))`,
          }}
        >
          {greeting}
        </h1>

        <p className="text-white/60 text-lg md:text-xl mb-12 max-w-md mx-auto">
          Click anywhere to say hi back!
        </p>

        <div className="flex items-center justify-center gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
            <p className="text-white/40 text-sm mb-1">Greetings sent</p>
            <p className="text-3xl font-bold text-white">{clickCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
            <p className="text-white/40 text-sm mb-1">Current mood</p>
            <p className="text-3xl">
              {clickCount === 0 ? '😐' : clickCount < 5 ? '😊' : clickCount < 15 ? '🤩' : clickCount < 30 ? '🥳' : '🤯'}
            </p>
          </div>
        </div>

        {clickCount >= 50 && (
          <div className="mt-8 animate-bounce">
            <p className="text-yellow-300 text-xl font-bold">🏆 Achievement Unlocked: Greeting Master! 🏆</p>
          </div>
        )}
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
    </div>
  )
}
