// ──────────────────────────────────────────
// AuthModal — premium cinematic full-screen auth overlay
// Benchmarked against Stripe, Linear, Vercel standard aesthetics
// ──────────────────────────────────────────
import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';


/* ── Clean, Label-First Input Field ── */
function AuthInput({ label, id, type, placeholder, value, onChange, required = true, minLength }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-ash">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          className="w-full px-4 py-3 rounded-xl bg-surface-base border border-surface-border
                     text-sm text-textWhite placeholder-mist/40 font-body
                     focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                     transition-all duration-200"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-mist/60 hover:text-textWhite transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
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
    [mode, email, password, fullName, signInWithEmail, signUpWithEmail, handleClose]
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
          transition={{ duration: 0.2 }}
        >
          {/* Subtle Dimming Backdrop */}
          <motion.div
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal Card - Solid Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-[400px] border border-surface-border bg-surface-2 rounded-2xl shadow-2xl overflow-hidden shadow-black/50"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-lg text-mist hover:text-textWhite hover:bg-surface-3 transition-colors z-20"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="px-8 pt-10 pb-6 text-center border-b border-surface-border/50">
              <div className="w-12 h-12 mx-auto mb-5 rounded-xl overflow-hidden border border-surface-border shadow-md">
                <img src="/unnamed.jpg" alt="UOE Avatar" className="w-full h-full object-cover" />
              </div>

              <h2 className="font-display text-xl font-semibold text-textWhite tracking-wide">
                {mode === 'signin' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-sm text-ash mt-1.5">
                {mode === 'signin' ? 'Sign in to your UOE portal' : 'Join the UOE unified platform'}
              </p>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-5">
              
              {mode === 'signup' && (
                <AuthInput
                  id="fullname"
                  label="Full Name"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}

              <AuthInput
                id="email"
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <AuthInput
                id="password"
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />

              {/* Status Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium text-red-400"
                  >
                    {error}
                  </motion.div>
                )}
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium text-green-400"
                  >
                    {successMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 rounded-xl mt-2
                           bg-textWhite text-surface-base font-semibold text-sm
                           hover:bg-cream active:scale-[0.98]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-surface-base" />
                ) : (
                  mode === 'signin' ? 'Continue' : 'Create Account'
                )}
              </button>
              
              {/* Auth Switcher */}
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-sm text-ash hover:text-textWhite transition-colors"
                >
                  {mode === 'signin' 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"}
                </button>
              </div>

            </form>

            {/* Footer */}
            <div className="px-8 pb-5 text-center">
              <p className="text-xs text-mist/60 text-balance">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(AuthModal);
