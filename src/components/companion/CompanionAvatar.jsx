import React, { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const SPECIES_SHAPES = {
  celestial: { body: 'ellipse', ears: 'star', eyes: 'sparkle' },
  aquatic: { body: 'blob', ears: 'fin', eyes: 'round' },
  forest: { body: 'fluffy', ears: 'leaf', eyes: 'almond' },
  crystal: { body: 'geometric', ears: 'crystal', eyes: 'gem' },
  shadow: { body: 'wisp', ears: 'flame', eyes: 'glow' }
};

const MOOD_ANIMATIONS = {
  joyful: { scale: [1, 1.04, 1], rotate: [-1.5, 1.5, -1.5], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
  content: { y: [0, -4, 0], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
  neutral: { opacity: [1, 0.96, 1], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } },
  sad: { y: [0, 2, 0], scale: 0.97, transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } },
  tired: { rotate: [-1, 1, -1], transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' } },
  excited: { scale: [1, 1.07, 1], y: [0, -7, 0], transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } },
  curious: { rotate: [0, 4, 0, -4, 0], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }
};

export default function CompanionAvatar({ companion, size = 'large', interactive = true }) {
  const canvasRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  
  const sizeMap = useMemo(() => ({
    small: { width: 120, height: 120 },
    medium: { width: 200, height: 200 },
    large: { width: 300, height: 300 }
  }), []);
  
  const dimensions = useMemo(() => sizeMap[size] || sizeMap.large, [size, sizeMap]);
  
  useEffect(() => {
    if (!canvasRef.current || !companion) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    const pixelRatio = window.devicePixelRatio || 1;
    let frameId = 0;
    
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const drawFrame = (timestamp = 0) => {
      drawCompanionFrame(ctx, companion, dimensions, timestamp / 1000, prefersReducedMotion || !interactive);
      if (interactive && !prefersReducedMotion) {
        frameId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame(0);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [companion, dimensions, interactive, prefersReducedMotion]);
  
  if (!companion) return null;
  
  const moodAnimation = MOOD_ANIMATIONS[companion.mood] || MOOD_ANIMATIONS.neutral;
  
  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={interactive ? moodAnimation : {}}
      whileHover={interactive ? { scale: 1.05 } : {}}
      whileTap={interactive ? { scale: 0.95 } : {}}
    >
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width, height: dimensions.height }}
        className="drop-shadow-2xl"
        aria-label={`${companion.name || 'Perfect Pupil'} avatar`}
      />
      
      {/* Particle effects for special moods */}
      {companion.mood === 'joyful' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: companion.accent_color }}
              initial={{ x: dimensions.width / 2, y: dimensions.height / 2 }}
              animate={{
                x: dimensions.width / 2 + Math.cos(i * 72 * Math.PI / 180) * 60,
                y: dimensions.height / 2 + Math.sin(i * 72 * Math.PI / 180) * 60 - 20,
                opacity: [0, 1, 0],
                scale: [0, 1, 0]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function drawCompanionFrame(ctx, companion, dimensions, time, isStill) {
  const { width, height } = dimensions;
  const centerX = width / 2;
  const centerY = height / 2;
  const baseSize = Math.min(width, height) * 0.35;
  const moodPulse = getMoodPulse(companion.mood);
  const breath = isStill ? 0 : Math.sin(time * moodPulse.speed) * moodPulse.amount;
  const floatY = isStill ? 0 : Math.sin(time * moodPulse.speed * 0.7 + 0.4) * moodPulse.float;
  const drawSize = baseSize * (1 + breath);
  const drawY = centerY + floatY;

  ctx.clearRect(0, 0, width, height);

  // Draw glow effect
  const glowSize = drawSize * (1.45 + Math.max(0, breath) * 2);
  const gradient = ctx.createRadialGradient(centerX, drawY, 0, centerX, drawY, glowSize);
  gradient.addColorStop(0, withAlpha(companion.primary_color, '40'));
  gradient.addColorStop(0.55, withAlpha(companion.secondary_color, '22'));
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, drawY, glowSize, 0, Math.PI * 2);
  ctx.fill();

  // Draw body based on species
  ctx.fillStyle = companion.primary_color || '#9b87f5';
  ctx.beginPath();

  switch (companion.species) {
    case 'celestial':
      drawCelestialBody(ctx, centerX, drawY, drawSize, time);
      break;
    case 'aquatic':
      drawAquaticBody(ctx, centerX, drawY, drawSize, time);
      break;
    case 'forest':
      drawForestBody(ctx, centerX, drawY, drawSize, time);
      break;
    case 'crystal':
      drawCrystalBody(ctx, centerX, drawY, drawSize);
      break;
    case 'shadow':
      drawShadowBody(ctx, centerX, drawY, drawSize, time);
      break;
    default:
      ctx.arc(centerX, drawY, drawSize, 0, Math.PI * 2);
  }
  ctx.fill();

  // Draw secondary features
  ctx.fillStyle = companion.secondary_color || '#7dd3c0';
  drawSecondaryFeatures(ctx, centerX, drawY, drawSize, companion.species, time);

  // Draw eyes and mouth based on mood
  drawEyes(ctx, centerX, drawY, drawSize, companion.mood, companion.accent_color, time, isStill);
  drawMouth(ctx, centerX, drawY + drawSize * 0.3, drawSize * 0.4, companion.mood);
}

function withAlpha(color, alphaHex) {
  const value = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return `${value}${alphaHex}`;
  return value || '#9b87f5';
}

function getMoodPulse(mood) {
  const pulses = {
    joyful: { speed: 4.4, amount: 0.025, float: 3.5 },
    content: { speed: 2.4, amount: 0.015, float: 2 },
    neutral: { speed: 1.8, amount: 0.01, float: 1.2 },
    sad: { speed: 1.5, amount: 0.008, float: 1 },
    tired: { speed: 1.1, amount: 0.006, float: 0.8 },
    excited: { speed: 5.2, amount: 0.03, float: 4.5 },
    curious: { speed: 2.8, amount: 0.018, float: 2.5 }
  };
  return pulses[mood] || pulses.neutral;
}

function drawCelestialBody(ctx, x, y, size, time = 0) {
  // Star-like body with soft curves
  const points = 8;
  const innerRadius = size * 0.7;
  const outerRadius = size;
  const twinkle = Math.sin(time * 1.8) * size * 0.015;
  
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = (i % 2 === 0 ? outerRadius : innerRadius) + twinkle;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x, y, px, py);
  }
  ctx.closePath();
}

function drawAquaticBody(ctx, x, y, size, time = 0) {
  // Blob-like body
  const sway = Math.sin(time * 1.6) * size * 0.04;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(x + size + sway, y - size * 0.8, x + size - sway, y + size * 0.8, x, y + size);
  ctx.bezierCurveTo(x - size + sway, y + size * 0.8, x - size - sway, y - size * 0.8, x, y - size);
  ctx.closePath();
}

function drawForestBody(ctx, x, y, size, time = 0) {
  // Fluffy round body
  ctx.beginPath();
  const bumps = 12;
  for (let i = 0; i < bumps; i++) {
    const angle = (i / bumps) * Math.PI * 2;
    const bumpSize = size * (0.98 + Math.sin(time * 1.25 + i * 1.7) * 0.04);
    const px = x + Math.cos(angle) * bumpSize;
    const py = y + Math.sin(angle) * bumpSize;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(
      x + Math.cos(angle - 0.15) * size * 1.1,
      y + Math.sin(angle - 0.15) * size * 1.1,
      px, py
    );
  }
  ctx.closePath();
}

function drawCrystalBody(ctx, x, y, size) {
  // Geometric hexagonal body
  ctx.beginPath();
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawShadowBody(ctx, x, y, size, time = 0) {
  // Wispy flame-like body
  const wisp = Math.sin(time * 2.4) * size * 0.06;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.quadraticCurveTo(x - size * 0.8, y + size * 0.5, x - size * 0.6, y);
  ctx.quadraticCurveTo(x - size * 0.4 - wisp, y - size * 0.8, x, y - size);
  ctx.quadraticCurveTo(x + size * 0.4 + wisp, y - size * 0.8, x + size * 0.6, y);
  ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.5, x, y + size);
  ctx.closePath();
}

function drawSecondaryFeatures(ctx, x, y, size, species, time = 0) {
  // Draw ears/appendages based on species
  const sway = Math.sin(time * 1.7) * size * 0.03;
  ctx.beginPath();
  
  switch (species) {
    case 'celestial':
      // Small floating orbs
      ctx.arc(x - size * 0.8, y - size * 0.5 + sway, size * 0.15, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y - size * 0.5 - sway, size * 0.15, 0, Math.PI * 2);
      break;
    case 'aquatic':
      // Fins
      ctx.ellipse(x - size, y, size * 0.3, size * 0.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.ellipse(x + size, y, size * 0.3, size * 0.5, -Math.PI / 4, 0, Math.PI * 2);
      break;
    case 'forest':
      // Leaf ears
      ctx.ellipse(x - size * 0.6, y - size * 0.8, size * 0.2, size * 0.4, -Math.PI / 6, 0, Math.PI * 2);
      ctx.ellipse(x + size * 0.6, y - size * 0.8, size * 0.2, size * 0.4, Math.PI / 6, 0, Math.PI * 2);
      break;
    case 'crystal':
      // Crystal points
      ctx.moveTo(x - size * 0.5, y - size * 0.8);
      ctx.lineTo(x - size * 0.3, y - size * 1.3);
      ctx.lineTo(x - size * 0.1, y - size * 0.8);
      ctx.moveTo(x + size * 0.5, y - size * 0.8);
      ctx.lineTo(x + size * 0.3, y - size * 1.3);
      ctx.lineTo(x + size * 0.1, y - size * 0.8);
      break;
    case 'shadow':
      // Wispy tendrils
      ctx.moveTo(x - size * 0.4, y - size * 0.6);
      ctx.quadraticCurveTo(x - size * 0.8, y - size * 1.2, x - size * 0.3, y - size * 1.1);
      ctx.moveTo(x + size * 0.4, y - size * 0.6);
      ctx.quadraticCurveTo(x + size * 0.8, y - size * 1.2, x + size * 0.3, y - size * 1.1);
      break;
  }
  ctx.fill();
}

function drawEyes(ctx, x, y, size, mood, accentColor, time = 0, isStill = false) {
  const eyeY = y - size * 0.1;
  const eyeSpacing = size * 0.35;
  const eyeSize = size * 0.15;
  const blinkWave = isStill ? 1 : Math.abs(Math.sin(time * 0.55));
  const blink = blinkWave > 0.965 ? Math.max(0.18, 1 - (blinkWave - 0.965) * 20) : 1;
  const gazeX = isStill ? 0 : Math.sin(time * 0.85) * eyeSize * 0.18;
  const gazeY = isStill ? 0 : Math.sin(time * 0.6 + 1.4) * eyeSize * 0.12;
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - eyeSpacing, eyeY, eyeSize, eyeSize * 1.2 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(x + eyeSpacing, eyeY, eyeSize, eyeSize * 1.2 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupils - adjust based on mood
  ctx.fillStyle = '#1a1a2e';
  let pupilSize = eyeSize * 0.6;
  let pupilOffsetY = 0;
  
  switch (mood) {
    case 'joyful':
    case 'excited':
      pupilSize = eyeSize * 0.7;
      break;
    case 'sad':
    case 'tired':
      pupilOffsetY = eyeSize * 0.2;
      pupilSize = eyeSize * 0.5;
      break;
    case 'curious':
      pupilSize = eyeSize * 0.8;
      break;
  }
  
  ctx.beginPath();
  ctx.ellipse(x - eyeSpacing + gazeX, eyeY + pupilOffsetY + gazeY, pupilSize, pupilSize * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(x + eyeSpacing + gazeX, eyeY + pupilOffsetY + gazeY, pupilSize, pupilSize * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Eye sparkle
  ctx.fillStyle = accentColor || '#ffffff';
  ctx.beginPath();
  ctx.arc(x - eyeSpacing + gazeX + pupilSize * 0.3, eyeY + gazeY - pupilSize * 0.3, pupilSize * 0.28 * blink, 0, Math.PI * 2);
  ctx.arc(x + eyeSpacing + gazeX + pupilSize * 0.3, eyeY + gazeY - pupilSize * 0.3, pupilSize * 0.28 * blink, 0, Math.PI * 2);
  ctx.fill();
}

function drawMouth(ctx, x, y, width, mood) {
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  
  switch (mood) {
    case 'joyful':
    case 'excited':
      ctx.arc(x, y - width * 0.3, width * 0.4, 0.2 * Math.PI, 0.8 * Math.PI);
      break;
    case 'content':
      ctx.arc(x, y - width * 0.2, width * 0.3, 0.1 * Math.PI, 0.9 * Math.PI);
      break;
    case 'sad':
      ctx.arc(x, y + width * 0.3, width * 0.3, 1.2 * Math.PI, 1.8 * Math.PI);
      break;
    case 'tired':
      ctx.moveTo(x - width * 0.2, y);
      ctx.lineTo(x + width * 0.2, y);
      break;
    case 'curious':
      ctx.ellipse(x, y, width * 0.15, width * 0.2, 0, 0, Math.PI * 2);
      break;
    default:
      ctx.moveTo(x - width * 0.2, y);
      ctx.quadraticCurveTo(x, y + width * 0.1, x + width * 0.2, y);
  }
  ctx.stroke();
}
