// ──────────────────────────────────────────
// AuthModal — cinematic full-screen auth overlay
// Inspired by LangSmith's clean login flow
// ──────────────────────────────────────────
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, LogIn, UserPlus, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';

/* ── Floating particle background ── */
function FloatingParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 185, 74, ${p.opacity})`;
        ctx.fill();
      });

      // Draw connections
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(200, 185, 74, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}





/* ── Input field with animated focus ── */
function AuthInput({ icon: Icon, type, placeholder, value, onChange, required = true, minLength, delay = 0 }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        animate={focused ? {
          boxShadow: '0 0 0 2px rgba(200,185,74,0.2), 0 0 24px -4px rgba(200,185,74,0.1)',
        } : {
          boxShadow: '0 0 0 0px transparent, 0 0 0px 0px transparent',
        }}
        transition={{ duration: 0.3 }}
      />

      <Icon className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${
        focused ? 'text-mustard-400' : 'text-mist/60'
      }`} />

      <input
        type={isPassword && showPassword ? 'text' : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full pl-10 pr-10 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]
                   text-sm text-cream placeholder-mist/40 font-body
                   focus:outline-none focus:border-mustard-500/30 focus:bg-white/[0.05]
                   transition-all duration-300"
      />

      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mist/50 hover:text-cream transition-colors"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </motion.div>
  );
}



/* ── Main Modal ── */
function AuthModal() {
  const authModalOpen = useAuthStore((s) => s.authModalOpen);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setFullName('');
    setError('');
    setSuccessMessage('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    closeAuthModal();
  }, [resetForm, closeAuthModal]);

  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setSuccessMessage('');
      setLoading(true);

      try {
        if (mode === 'signup') {
          const data = await signUpWithEmail(email, password, fullName);
          if (data?.user && !data.session) {
            setSuccessMessage('Check your email to confirm your account!');
          } else {
            handleClose();
          }
        } else {
          await signInWithEmail(email, password);
          handleClose();
        }
      } catch (err) {
        setError(err.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, fullName, signInWithEmail, signUpWithEmail, handleClose],
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && handleClose();
    if (authModalOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authModalOpen, handleClose]);

  return (
    <AnimatePresence>
      {authModalOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Particle background */}
          <FloatingParticles />

          {/* Ambient glow orbs */}
          <motion.div
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-[150px] pointer-events-none"
            style={{ background: 'rgba(200,185,74,0.06)' }}
            animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full blur-[140px] pointer-events-none"
            style={{ background: 'rgba(99,102,241,0.04)' }}
            animate={{ x: [0, -15, 0], y: [0, 20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-[420px] overflow-hidden"
          >
            {/* Glass card */}
            <div className="relative rounded-2xl border border-white/[0.08] bg-navy-900/90 backdrop-blur-2xl shadow-2xl overflow-hidden">

              {/* Top gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mustard-500/40 to-transparent" />

              {/* Close button */}
              <motion.button
                onClick={handleClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="absolute top-4 right-4 p-2 rounded-lg text-mist/60 hover:text-cream
                           hover:bg-white/[0.06] transition-colors z-20"
              >
                <X className="w-4 h-4" />
              </motion.button>

              {/* ── Header ── */}
              <div className="px-8 pt-8 pb-2 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-16 h-16 mx-auto mb-5 rounded-2xl overflow-hidden
                             border border-white/[0.08] shadow-lg shadow-mustard-500/10"
                >
                  <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="font-display text-2xl font-bold text-cream tracking-wide"
                >
                  UOE AI Assistant
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-mist mt-1.5"
                >
                  Your intelligent university companion
                </motion.p>
              </div>

              {/* ── Tab switcher ── */}
              <div className="px-8 pt-4 pb-2">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div
                    className="relative flex bg-white/[0.04] rounded-xl p-1 border border-white/[0.06] cursor-pointer"
                  >
                    <motion.div
                      className="absolute top-1 bottom-1 rounded-lg bg-mustard-500/15 border border-mustard-500/25"
                      initial={false}
                      animate={{
                        left: mode === 'signin' ? '4px' : 'calc(50%)',
                        width: 'calc(50% - 4px)',
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                    {['signin', 'signup'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => switchMode(tab)}
                        className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 ${
                          mode === tab ? 'text-mustard-400' : 'text-mist hover:text-cream'
                        }`}
                      >
                        {tab === 'signin' ? 'Sign In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="px-8 pt-4 pb-4 space-y-3">
                <AnimatePresence mode="popLayout">
                  {mode === 'signup' && (
                    <AuthInput
                      key="fullname"
                      icon={User}
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      delay={0}
                    />
                  )}
                </AnimatePresence>

                <AuthInput
                  key="email"
                  icon={Mail}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  delay={mode === 'signup' ? 0.05 : 0}
                />

                <AuthInput
                  key="password"
                  icon={Lock}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  delay={mode === 'signup' ? 0.1 : 0.05}
                />

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Success */}
                <AnimatePresence>
                  {successMessage && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5"
                    >
                      {successMessage}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                             bg-gradient-to-r from-mustard-600 to-mustard-500
                             hover:from-mustard-500 hover:to-mustard-400
                             text-navy-950 font-semibold text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-300
                             shadow-lg shadow-mustard-500/20 hover:shadow-mustard-500/30"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === 'signin' ? (
                        <>
                          <LogIn className="w-4 h-4" />
                          Sign In
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Create Account
                        </>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* ── Footer ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="px-8 pb-7 pt-1 text-center"
              >
                <p className="text-2xs text-mist/50">
                  By continuing, you agree to our Terms of Service
                </p>
              </motion.div>

              {/* Bottom gradient accent */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(AuthModal);
