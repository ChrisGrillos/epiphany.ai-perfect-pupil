import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Sparkles, Lock } from 'lucide-react';

// DNA Element types with colors
const DNA_ELEMENTS = {
  body: {
    color: '#ec4899',
    elements: ['form', 'size', 'texture', 'shape', 'density']
  },
  personality: {
    color: '#8b5cf6',
    elements: ['openness', 'energy', 'curiosity', 'empathy', 'playfulness']
  },
  intelligence: {
    color: '#06b6d4',
    elements: ['logic', 'creativity', 'memory', 'language', 'intuition']
  },
  emotional: {
    color: '#f59e0b',
    elements: ['joy', 'calm', 'wonder', 'trust', 'resilience']
  },
  abilities: {
    color: '#10b981',
    elements: ['healing', 'insight', 'protection', 'growth', 'harmony']
  }
};

const HELIX_SECTIONS = ['body', 'personality', 'intelligence', 'emotional', 'abilities'];

export default function DNAGrid({ 
  companion, 
  puzzle, 
  onComplete, 
  isLocked = false,
  difficulty = 'easy' 
}) {
  const [grid, setGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [moves, setMoves] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const canvasRef = useRef(null);
  
  // Initialize grid based on puzzle type and difficulty
  useEffect(() => {
    initializeGrid();
  }, [puzzle, difficulty]);
  
  // Draw helix background
  useEffect(() => {
    drawHelixBackground();
  }, [activeSection]);
  
  const initializeGrid = () => {
    const sections = HELIX_SECTIONS.map((section, sectionIndex) => {
      const sectionData = DNA_ELEMENTS[section];
      const elements = [...sectionData.elements];
      
      // Shuffle based on difficulty
      const shuffleCount = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;
      for (let i = 0; i < shuffleCount; i++) {
        const a = Math.floor(Math.random() * elements.length);
        const b = Math.floor(Math.random() * elements.length);
        [elements[a], elements[b]] = [elements[b], elements[a]];
      }
      
      return {
        name: section,
        color: sectionData.color,
        cells: elements.map((el, i) => ({
          id: `${section}-${i}`,
          element: el,
          isCorrect: el === sectionData.elements[i],
          targetElement: sectionData.elements[i]
        }))
      };
    });
    
    setGrid(sections);
    setIsComplete(false);
    setMoves(0);
  };
  
  const drawHelixBackground = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw double helix pattern
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
    
    const amplitude = 40;
    const frequency = 0.02;
    const centerY = height / 2;
    
    // First strand
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * frequency) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Second strand (offset)
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * frequency + Math.PI) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Draw connecting bars
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
    for (let x = 20; x < width; x += 40) {
      const y1 = centerY + Math.sin(x * frequency) * amplitude;
      const y2 = centerY + Math.sin(x * frequency + Math.PI) * amplitude;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }
  };
  
  const handleCellClick = (sectionIndex, cellIndex) => {
    if (isLocked || isComplete) return;
    
    if (selectedCell === null) {
      setSelectedCell({ section: sectionIndex, cell: cellIndex });
    } else if (selectedCell.section === sectionIndex) {
      // Swap within same section
      const newGrid = [...grid];
      const section = newGrid[sectionIndex];
      const temp = section.cells[selectedCell.cell].element;
      section.cells[selectedCell.cell].element = section.cells[cellIndex].element;
      section.cells[cellIndex].element = temp;
      
      // Update correctness
      section.cells.forEach((cell, i) => {
        cell.isCorrect = cell.element === cell.targetElement;
      });
      
      setGrid(newGrid);
      setSelectedCell(null);
      setMoves(prev => prev + 1);
      
      // Check if puzzle is complete
      checkCompletion(newGrid);
    } else {
      // Select new cell
      setSelectedCell({ section: sectionIndex, cell: cellIndex });
    }
  };
  
  const checkCompletion = (currentGrid) => {
    const allCorrect = currentGrid.every(section =>
      section.cells.every(cell => cell.isCorrect)
    );
    
    if (allCorrect) {
      setIsComplete(true);
      if (onComplete) {
        onComplete({
          moves,
          sections: currentGrid.map(s => s.name),
          difficulty
        });
      }
    }
  };
  
  const resetPuzzle = () => {
    initializeGrid();
    setSelectedCell(null);
  };
  
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-2xl border border-slate-200">
        <Lock className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">Evolution Locked</h3>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          Upgrade to Premium or Elite to unlock the Guided Evolution puzzle and customize your companion's growth.
        </p>
      </div>
    );
  }
  
  return (
    <div className="relative">
      {/* Helix Background */}
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="absolute inset-0 w-full h-full opacity-50 pointer-events-none"
      />
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              Guided Evolution
            </h3>
            <p className="text-sm text-slate-500">Arrange DNA sequences to evolve your companion</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Moves: <strong>{moves}</strong></span>
            <Button variant="outline" size="sm" onClick={resetPuzzle}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
        
        {/* DNA Helix Grid */}
        <div className="grid gap-4">
          {grid.map((section, sectionIndex) => (
            <motion.div
              key={section.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="relative"
            >
              {/* Section Label */}
              <div 
                className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-center"
                style={{ color: section.color }}
              >
                <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                  {section.name}
                </span>
              </div>
              
              {/* Hexagonal Cells */}
              <div className="ml-8 flex gap-2 justify-center">
                {section.cells.map((cell, cellIndex) => {
                  const isSelected = selectedCell?.section === sectionIndex && selectedCell?.cell === cellIndex;
                  
                  return (
                    <motion.button
                      key={cell.id}
                      onClick={() => handleCellClick(sectionIndex, cellIndex)}
                      whileHover={{ scale: 1.1, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      animate={{
                        y: Math.sin((sectionIndex + cellIndex) * 0.5) * 5,
                      }}
                      transition={{ 
                        y: { duration: 2, repeat: Infinity, repeatType: 'reverse' }
                      }}
                      className={`
                        relative w-20 h-20 rounded-xl flex flex-col items-center justify-center
                        transition-all duration-200 text-white font-medium text-xs
                        ${isSelected ? 'ring-4 ring-white ring-offset-2 scale-110' : ''}
                        ${cell.isCorrect ? 'opacity-100' : 'opacity-80'}
                      `}
                      style={{ 
                        backgroundColor: section.color,
                        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
                      }}
                    >
                      <span className="capitalize">{cell.element}</span>
                      {cell.isCorrect && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-3 h-3" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Completion Animation */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-20 h-20 mx-auto mb-4"
                >
                  <Sparkles className="w-full h-full text-violet-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Evolution Complete!</h3>
                <p className="text-slate-600 mb-4">
                  Solved in {moves} moves
                </p>
                <Button onClick={resetPuzzle} className="bg-violet-600 hover:bg-violet-700">
                  Try Another Puzzle
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}