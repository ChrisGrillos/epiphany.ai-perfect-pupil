import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const SPECIES_SHAPES = {
  celestial: { body: 'ellipse', ears: 'star', eyes: 'sparkle' },
  aquatic: { body: 'blob', ears: 'fin', eyes: 'round' },
  forest: { body: 'fluffy', ears: 'leaf', eyes: 'almond' },
  crystal: { body: 'geometric', ears: 'crystal', eyes: 'gem' },
  shadow: { body: 'wisp', ears: 'flame', eyes: 'glow' }
};

const MOOD_ANIMATIONS = {
  joyful: { scale: [1, 1.1, 1], rotate: [-3, 3, -3], transition: { duration: 0.5, repeat: Infinity } },
  content: { y: [0, -5, 0], transition: { duration: 2, repeat: Infinity } },
  neutral: { opacity: [1, 0.9, 1], transition: { duration: 3, repeat: Infinity } },
  sad: { y: [0, 2, 0], scale: 0.95, transition: { duration: 2, repeat: Infinity } },
  tired: { rotate: [-2, 2, -2], transition: { duration: 4, repeat: Infinity } },
  excited: { scale: [1, 1.15, 1], y: [0, -10, 0], transition: { duration: 0.3, repeat: Infinity } },
  curious: { rotate: [0, 15, 0, -15, 0], transition: { duration: 2, repeat: Infinity } }
};

export default function CompanionAvatar({ companion, size = 'large', interactive = true }) {
  const canvasRef = useRef(null);
  
  const sizeMap = {
    small: { width: 120, height: 120 },
    medium: { width: 200, height: 200 },
    large: { width: 300, height: 300 }
  };
  
  const dimensions = sizeMap[size] || sizeMap.large;
  
  useEffect(() => {
    if (!canvasRef.current || !companion) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);
    
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const baseSize = Math.min(width, height) * 0.35;
    
    // Draw glow effect
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseSize * 1.5);
    gradient.addColorStop(0, companion.primary_color + '40');
    gradient.addColorStop(0.5, companion.secondary_color + '20');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseSize * 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw body based on species
    ctx.fillStyle = companion.primary_color;
    ctx.beginPath();
    
    switch (companion.species) {
      case 'celestial':
        drawCelestialBody(ctx, centerX, centerY, baseSize);
        break;
      case 'aquatic':
        drawAquaticBody(ctx, centerX, centerY, baseSize);
        break;
      case 'forest':
        drawForestBody(ctx, centerX, centerY, baseSize);
        break;
      case 'crystal':
        drawCrystalBody(ctx, centerX, centerY, baseSize);
        break;
      case 'shadow':
        drawShadowBody(ctx, centerX, centerY, baseSize);
        break;
      default:
        ctx.arc(centerX, centerY, baseSize, 0, Math.PI * 2);
    }
    ctx.fill();
    
    // Draw secondary features
    ctx.fillStyle = companion.secondary_color;
    drawSecondaryFeatures(ctx, centerX, centerY, baseSize, companion.species);
    
    // Draw eyes based on mood
    drawEyes(ctx, centerX, centerY, baseSize, companion.mood, companion.accent_color);
    
    // Draw mouth based on mood
    drawMouth(ctx, centerX, centerY + baseSize * 0.3, baseSize * 0.4, companion.mood);
    
  }, [companion, dimensions]);
  
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

function drawCelestialBody(ctx, x, y, size) {
  // Star-like body with soft curves
  const points = 8;
  const innerRadius = size * 0.7;
  const outerRadius = size;
  
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x, y, px, py);
  }
  ctx.closePath();
}

function drawAquaticBody(ctx, x, y, size) {
  // Blob-like body
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.bezierCurveTo(x + size, y - size * 0.8, x + size, y + size * 0.8, x, y + size);
  ctx.bezierCurveTo(x - size, y + size * 0.8, x - size, y - size * 0.8, x, y - size);
  ctx.closePath();
}

function drawForestBody(ctx, x, y, size) {
  // Fluffy round body
  ctx.beginPath();
  const bumps = 12;
  for (let i = 0; i < bumps; i++) {
    const angle = (i / bumps) * Math.PI * 2;
    const bumpSize = size * (0.9 + Math.random() * 0.2);
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

function drawShadowBody(ctx, x, y, size) {
  // Wispy flame-like body
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.quadraticCurveTo(x - size * 0.8, y + size * 0.5, x - size * 0.6, y);
  ctx.quadraticCurveTo(x - size * 0.4, y - size * 0.8, x, y - size);
  ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.8, x + size * 0.6, y);
  ctx.quadraticCurveTo(x + size * 0.8, y + size * 0.5, x, y + size);
  ctx.closePath();
}

function drawSecondaryFeatures(ctx, x, y, size, species) {
  // Draw ears/appendages based on species
  ctx.beginPath();
  
  switch (species) {
    case 'celestial':
      // Small floating orbs
      ctx.arc(x - size * 0.8, y - size * 0.5, size * 0.15, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y - size * 0.5, size * 0.15, 0, Math.PI * 2);
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

function drawEyes(ctx, x, y, size, mood, accentColor) {
  const eyeY = y - size * 0.1;
  const eyeSpacing = size * 0.35;
  const eyeSize = size * 0.15;
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - eyeSpacing, eyeY, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2);
  ctx.ellipse(x + eyeSpacing, eyeY, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2);
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
  ctx.arc(x - eyeSpacing, eyeY + pupilOffsetY, pupilSize, 0, Math.PI * 2);
  ctx.arc(x + eyeSpacing, eyeY + pupilOffsetY, pupilSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Eye sparkle
  ctx.fillStyle = accentColor || '#ffffff';
  ctx.beginPath();
  ctx.arc(x - eyeSpacing + pupilSize * 0.3, eyeY - pupilSize * 0.3, pupilSize * 0.3, 0, Math.PI * 2);
  ctx.arc(x + eyeSpacing + pupilSize * 0.3, eyeY - pupilSize * 0.3, pupilSize * 0.3, 0, Math.PI * 2);
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