// ──────────────────────────────────────────
// useTypewriter — character-by-character text reveal with gradient crossfade
// ──────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';

export function useTypewriter(text, options = {}) {
  const {
    speed = 40,
    delay = 0,
    loop = false,
    onComplete,
  } = options;

  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);
  const indexRef = useRef(0);

  const typeNextChar = useCallback(() => {
    if (indexRef.current < text.length) {
      setDisplayedText(text.slice(0, indexRef.current + 1));
      indexRef.current += 1;
      timeoutRef.current = setTimeout(typeNextChar, speed);
    } else {
      setIsTyping(false);
      setIsComplete(true);
      if (loop) {
        setTimeout(() => {
          indexRef.current = 0;
          setDisplayedText('');
          setIsComplete(false);
          setIsTyping(true);
          typeNextChar();
        }, 2000);
      } else if (onComplete) {
        onComplete();
      }
    }
  }, [text, speed, loop, onComplete]);

  useEffect(() => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsTyping(true);
        typeNextChar();
      }, delay);
    } else {
      setIsTyping(true);
      typeNextChar();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, delay]);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
    setIsTyping(true);
    typeNextChar();
  }, [typeNextChar]);

  return { displayedText, isTyping, isComplete, reset };
}

// ──────────────────────────────────────────
// useAnimatedCounter — elastic-out easing counter for statistics
// ──────────────────────────────────────────

export function useAnimatedCounter(end, options = {}) {
  const {
    duration = 1800,
    start = 0,
    easing = 'elastic',
  } = options;

  const [count, setCount] = useState(start);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);

  // Elastic out easing function
  const elasticOut = (t) => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  };

  useEffect(() => {
    const startCount = start;
    const difference = end - startCount;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      const easedProgress = easing === 'elastic' ? elasticOut(progress) : progress;
      const currentCount = Math.round(startCount + difference * easedProgress);

      setCount(currentCount);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration, start, easing]);

  return count;
}
