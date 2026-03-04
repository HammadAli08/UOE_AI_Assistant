// ──────────────────────────────────────────
// ThinkingAnimation — cinematic multi-phase pre-answer loading
// Standard RAG: 3 phases  |  Smart RAG: 4 phases
// ──────────────────────────────────────────
import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Phase Definitions ──

const STANDARD_PHASES = [
    {
        id: 'understand',
        label: 'Understanding your question',
        icon: 'brain',
        color: 'rgba(200, 185, 74, 0.6)',
        glowColor: 'rgba(200, 185, 74, 0.15)',
        duration: 1400,
    },
    {
        id: 'search',
        label: 'Searching documents',
        icon: 'search',
        color: 'rgba(99, 179, 237, 0.6)',
        glowColor: 'rgba(99, 179, 237, 0.15)',
        duration: 1800,
    },
    {
        id: 'craft',
        label: 'Crafting your answer',
        icon: 'pen',
        color: 'rgba(72, 187, 120, 0.6)',
        glowColor: 'rgba(72, 187, 120, 0.15)',
        duration: null, // stays until streaming starts
    },
];

const SMART_PHASES = [
    {
        id: 'analyze',
        label: 'Analyzing your question',
        icon: 'neural',
        color: 'rgba(167, 139, 250, 0.6)',
        glowColor: 'rgba(167, 139, 250, 0.15)',
        duration: 1400,
    },
    {
        id: 'deep-search',
        label: 'Deep searching knowledge base',
        icon: 'layers',
        color: 'rgba(99, 179, 237, 0.6)',
        glowColor: 'rgba(99, 179, 237, 0.15)',
        duration: 1800,
    },
    {
        id: 'grade',
        label: 'Grading document relevance',
        icon: 'shield',
        color: 'rgba(200, 185, 74, 0.6)',
        glowColor: 'rgba(200, 185, 74, 0.15)',
        duration: 1600,
    },
    {
        id: 'compose',
        label: 'Composing verified answer',
        icon: 'sparkle',
        color: 'rgba(72, 187, 120, 0.6)',
        glowColor: 'rgba(72, 187, 120, 0.15)',
        duration: null,
    },
];

// ── Animated SVG Icons ──

function BrainIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.path
                d="M12 2C9.5 2 7.5 3.5 7 5.5C5 6 3.5 7.5 3.5 10C3.5 12 4.5 13.5 6 14.5V19C6 20.1 6.9 21 8 21H10"
                stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.path
                d="M12 2C14.5 2 16.5 3.5 17 5.5C19 6 20.5 7.5 20.5 10C20.5 12 19.5 13.5 18 14.5V19C18 20.1 17.1 21 16 21H14"
                stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
            />
            <motion.path
                d="M12 2V21" stroke={color} strokeWidth="1.5" strokeDasharray="2 3"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0.3, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
        </svg>
    );
}

function SearchIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.circle
                cx="10.5" cy="10.5" r="6.5"
                stroke={color} strokeWidth="1.5"
                initial={{ pathLength: 0, scale: 0.8 }}
                animate={{ pathLength: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.line
                x1="15.5" y1="15.5" x2="21" y2="21"
                stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
            />
            {/* Scan line */}
            <motion.line
                x1="6" y1="10.5" x2="15" y2="10.5"
                stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"
                animate={{ y1: [7, 14, 7], y2: [7, 14, 7] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
        </svg>
    );
}

function PenIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.path
                d="M17 3L21 7L7 21H3V17L17 3Z"
                stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <motion.line
                x1="3" y1="21" x2="11" y2="21"
                stroke={color} strokeWidth="1.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
        </svg>
    );
}

function NeuralIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            {/* Center node */}
            <motion.circle cx="12" cy="12" r="2.5" fill={color}
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* Outer nodes */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const x = 12 + Math.cos(rad) * 7;
                const y = 12 + Math.sin(rad) * 7;
                return (
                    <g key={i}>
                        <motion.line x1="12" y1="12" x2={x} y2={y}
                            stroke={color} strokeWidth="1" opacity="0.4"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, delay: i * 0.08 }}
                        />
                        <motion.circle cx={x} cy={y} r="1.5" fill={color}
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.3 + i * 0.08 }}
                        />
                    </g>
                );
            })}
        </svg>
    );
}

function LayersIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.path d="M2 12L12 6L22 12L12 18L2 12Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }}
            />
            <motion.path d="M2 16L12 22L22 16" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.6"
                initial={{ pathLength: 0, y: -3 }} animate={{ pathLength: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
            />
            <motion.path d="M2 8L12 2L22 8" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.4"
                initial={{ pathLength: 0, y: 3 }} animate={{ pathLength: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
            />
        </svg>
    );
}

function ShieldIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.path
                d="M12 2L3 7V12C3 17.5 7 21.5 12 22C17 21.5 21 17.5 21 12V7L12 2Z"
                stroke={color} strokeWidth="1.5" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <motion.polyline points="9,12 11,14 15,10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
            />
        </svg>
    );
}

function SparkleIcon({ color }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="thinking-icon">
            <motion.path
                d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                stroke={color} strokeWidth="1.5" strokeLinejoin="round"
                initial={{ pathLength: 0, scale: 0.6 }}
                animate={{ pathLength: 1, scale: 1, rotate: [0, 5, -5, 0] }}
                transition={{ pathLength: { duration: 0.6 }, scale: { duration: 0.6 }, rotate: { duration: 3, repeat: Infinity } }}
            />
            {/* Tiny orbiting sparkle */}
            <motion.circle cx="18" cy="6" r="1" fill={color}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
        </svg>
    );
}

const ICON_MAP = {
    brain: BrainIcon,
    search: SearchIcon,
    pen: PenIcon,
    neural: NeuralIcon,
    layers: LayersIcon,
    shield: ShieldIcon,
    sparkle: SparkleIcon,
};

// ── Orbit Dots ──

function OrbitDots({ color }) {
    return (
        <div className="thinking-orbit-container">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="thinking-orbit-dot"
                    style={{ backgroundColor: color }}
                    animate={{
                        rotate: 360,
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: i * 0.83,
                    }}
                />
            ))}
        </div>
    );
}

// ── Progress Bar ──

function PhaseProgress({ currentIndex, total, color }) {
    return (
        <div className="thinking-progress-track">
            <motion.div
                className="thinking-progress-fill"
                style={{ backgroundColor: color }}
                initial={{ width: '0%' }}
                animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
        </div>
    );
}

// ── Main Component ──

function ThinkingAnimation({ mode = 'standard' }) {
    const phases = mode === 'smart' ? SMART_PHASES : STANDARD_PHASES;
    const [currentPhase, setCurrentPhase] = useState(0);

    // Reset phase when mode changes (new chat or toggle)
    useEffect(() => {
        setCurrentPhase(0);
    }, [mode]);

    // Auto-advance phases
    useEffect(() => {
        const phase = phases[currentPhase];
        if (!phase || phase.duration === null) return;

        const timer = setTimeout(() => {
            if (currentPhase < phases.length - 1) {
                setCurrentPhase((p) => p + 1);
            }
        }, phase.duration);

        return () => clearTimeout(timer);
    }, [currentPhase, phases]);

    const phase = phases[currentPhase];
    const IconComponent = ICON_MAP[phase.icon];

    return (
        <motion.div
            className="flex gap-2 sm:gap-3 px-2 sm:px-6 py-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-mustard-500/20 mt-0.5">
                <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
            </div>

            {/* Thinking Bubble */}
            <div className="thinking-bubble" style={{ '--phase-color': phase.color, '--phase-glow': phase.glowColor }}>
                {/* Ambient glow */}
                <div className="thinking-ambient-glow" style={{ background: phase.glowColor }} />

                {/* Phase content */}
                <div className="flex items-center gap-3 relative z-10">
                    {/* Animated icon with orbit */}
                    <div className="thinking-icon-wrapper">
                        <OrbitDots color={phase.color} />
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={phase.id}
                                initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="thinking-icon-inner"
                            >
                                <IconComponent color={phase.color} />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Label */}
                    <div className="flex flex-col gap-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={phase.id}
                                className="thinking-label"
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.25 }}
                            >
                                {phase.label}
                                <span className="thinking-dots">
                                    <span>.</span><span>.</span><span>.</span>
                                </span>
                            </motion.span>
                        </AnimatePresence>

                        {/* Phase progress */}
                        <PhaseProgress
                            currentIndex={currentPhase}
                            total={phases.length}
                            color={phase.color}
                        />
                    </div>
                </div>

                {/* Mode badge */}
                {mode === 'smart' && (
                    <motion.div
                        className="thinking-mode-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                                fill="rgba(167, 139, 250, 0.6)" />
                        </svg>
                        <span>Smart</span>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

export default memo(ThinkingAnimation);
