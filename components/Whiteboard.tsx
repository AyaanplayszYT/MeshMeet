import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Trash2, PenTool, X, Eraser, Download, Square, Circle, Minus, MoveRight, 
  Image as ImageIcon, StickyNote as StickyNoteIcon, Maximize2, LayoutGrid, Plus
} from 'lucide-react';
import { signaling } from '../services/socket';
import { DrawLine, ShapeType, StickyNote } from '../types';

interface WhiteboardProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'popup' | 'stage';
  onToggleMode?: () => void;
  currentUserName?: string;
}

const COLORS = [
  '#ffffff', // White
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#ef4444', // Red
  '#a855f7', // Purple
  '#ec4899', // Pink
];

const LINE_WIDTHS = [2, 4, 8];
const ERASER_SIZES = [12, 24, 48, 72];

const NOTE_COLORS: { key: StickyNote['color']; bg: string; border: string; text: string }[] = [
  { key: 'amber', bg: 'bg-amber-400/90', border: 'border-amber-300', text: 'text-amber-950' },
  { key: 'emerald', bg: 'bg-emerald-400/90', border: 'border-emerald-300', text: 'text-emerald-950' },
  { key: 'sky', bg: 'bg-sky-400/90', border: 'border-sky-300', text: 'text-sky-950' },
  { key: 'rose', bg: 'bg-rose-400/90', border: 'border-rose-300', text: 'text-rose-950' },
  { key: 'purple', bg: 'bg-purple-400/90', border: 'border-purple-300', text: 'text-purple-950' },
];

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeType,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (shape === 'line') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (shape === 'rectangle') {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.beginPath();
    ctx.strokeRect(left, top, w, h);
  } else if (shape === 'circle') {
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const cx = Math.min(x1, x2) + rx;
    const cy = Math.min(y1, y2) + ry;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(12, width * 3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }
  ctx.restore();
}

const TooltipButton: React.FC<{
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, onClick, active, danger, children, className = '' }) => (
  <div className="group/btn relative flex items-center justify-center">
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-xl transition-all ${
        active 
          ? 'bg-white text-black shadow-md font-bold' 
          : danger
          ? 'text-rose-400 hover:bg-rose-500/20'
          : 'text-zinc-400 hover:text-white hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </button>
    <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-950/95 backdrop-blur-md text-white text-[10px] font-medium rounded-lg border border-white/15 shadow-xl opacity-0 group-hover/btn:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50">
      {label}
    </div>
  </div>
);

const Whiteboard: React.FC<WhiteboardProps> = ({ 
  roomId, 
  isOpen, 
  onClose,
  mode = 'popup',
  onToggleMode,
  currentUserName = 'You'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<ShapeType>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [eraserSize, setEraserSize] = useState(24);

  // Collaborative Synced Sticky Notes
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const draggingNoteRef = useRef<{ id: string; startX: number; startY: number; initX: number; initY: number } | null>(null);

  const startPos = useRef<{ x: number; y: number } | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  // Helper to draw an image onto canvas and fit reasonably
  const drawImageOnCanvas = useCallback((dataUrl: string, x?: number, y?: number, w?: number, h?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const displayWidth = canvas.clientWidth || canvas.width;
      const displayHeight = canvas.clientHeight || canvas.height;
      const pixelRatio = canvas.width / displayWidth;
      let targetW = w === undefined ? img.naturalWidth : (w <= 1 ? w * displayWidth : w / pixelRatio);
      let targetH = h === undefined ? img.naturalHeight : (h <= 1 ? h * displayHeight : h / pixelRatio);

      const maxW = displayWidth * 0.55;
      const maxH = displayHeight * 0.55;
      if (!w || !h) {
        const scale = Math.min(1, maxW / targetW, maxH / targetH);
        targetW = targetW * scale;
        targetH = targetH * scale;
      }

      const targetX = x !== undefined ? x * displayWidth : (displayWidth - targetW) / 2;
      const targetY = y !== undefined ? y * displayHeight : (displayHeight - targetH) / 2;

      ctx.save();
      ctx.drawImage(img, targetX, targetY, targetW, targetH);
      ctx.restore();
    };
    img.src = dataUrl;
  }, []);

  // Sync Notes to all peers
  const syncNotes = useCallback((newNotes: StickyNote[]) => {
    setNotes(newNotes);
    signaling.emit('whiteboard-notes-update', { roomId, notes: newNotes });
  }, [roomId]);

  // Add new sticky note
  const handleAddNote = () => {
    const colorKeys: StickyNote['color'][] = ['amber', 'emerald', 'sky', 'rose', 'purple'];
    const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];
    const newNote: StickyNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: 25 + Math.random() * 35,
      y: 20 + Math.random() * 35,
      text: '',
      color: randomColor,
      author: currentUserName
    };
    const updated = [...notes, newNote];
    syncNotes(updated);
  };

  const handleUpdateNoteText = (id: string, text: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, text } : n);
    syncNotes(updated);
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    syncNotes(updated);
  };

  const handleCycleNoteColor = (id: string) => {
    const colorKeys: StickyNote['color'][] = ['amber', 'emerald', 'sky', 'rose', 'purple'];
    const updated = notes.map(n => {
      if (n.id === id) {
        const nextIdx = (colorKeys.indexOf(n.color) + 1) % colorKeys.length;
        return { ...n, color: colorKeys[nextIdx] };
      }
      return n;
    });
    syncNotes(updated);
  };

  // Dragging Sticky Notes
  const handleNoteDragStart = (e: React.MouseEvent | React.TouchEvent, note: StickyNote) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    draggingNoteRef.current = {
      id: note.id,
      startX: clientX,
      startY: clientY,
      initX: note.x,
      initY: note.y
    };
  };

  const handleNoteDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingNoteRef.current || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((clientX - draggingNoteRef.current.startX) / rect.width) * 100;
    const dy = ((clientY - draggingNoteRef.current.startY) / rect.height) * 100;

    const newX = Math.max(2, Math.min(85, draggingNoteRef.current.initX + dx));
    const newY = Math.max(2, Math.min(85, draggingNoteRef.current.initY + dy));

    setNotes(prev => prev.map(n => n.id === draggingNoteRef.current?.id ? { ...n, x: newX, y: newY } : n));
  }, []);

  const handleNoteDragEnd = useCallback(() => {
    if (draggingNoteRef.current) {
      draggingNoteRef.current = null;
      setNotes(currentNotes => {
        signaling.emit('whiteboard-notes-update', { roomId, notes: currentNotes });
        return currentNotes;
      });
    }
  }, [roomId]);

  useEffect(() => {
    window.addEventListener('mousemove', handleNoteDragMove);
    window.addEventListener('mouseup', handleNoteDragEnd);
    window.addEventListener('touchmove', handleNoteDragMove);
    window.addEventListener('touchend', handleNoteDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleNoteDragMove);
      window.removeEventListener('mouseup', handleNoteDragEnd);
      window.removeEventListener('touchmove', handleNoteDragMove);
      window.removeEventListener('touchend', handleNoteDragEnd);
    };
  }, [handleNoteDragMove, handleNoteDragEnd]);

  // Clipboard Paste Support (Images)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (uploadEvent) => {
              const dataUrl = uploadEvent.target?.result as string;
              if (dataUrl && canvasRef.current) {
                drawImageOnCanvas(dataUrl);
                signaling.emit('whiteboard-image', {
                  roomId,
                  image: dataUrl,
                  x: 0.25,
                  y: 0.25,
                  width: 0.5,
                  height: 0.5
                });
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, roomId, drawImageOnCanvas]);

  // Image Upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && canvasRef.current) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl && canvasRef.current) {
          drawImageOnCanvas(dataUrl);
          signaling.emit('whiteboard-image', {
            roomId,
            image: dataUrl,
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Canvas Setup & Socket Listeners
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !isOpen) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const resizeCanvas = () => {
      if (containerRef.current && canvas && ctx) {
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
        let tempCanvas: HTMLCanvasElement | null = null;

        if (oldWidth > 0 && oldHeight > 0) {
          tempCanvas = document.createElement('canvas');
          tempCanvas.width = oldWidth;
          tempCanvas.height = oldHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(canvas, 0, 0);
          }
        }

        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        if (tempCanvas && tempCanvas.width > 0 && tempCanvas.height > 0) {
          ctx.drawImage(tempCanvas, 0, 0, oldWidth, oldHeight, 0, 0, width, height);
        }
      }
    };
    
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(containerRef.current);

    // Socket Event Listeners
    const handleRemoteDraw = (data: DrawLine) => {
      if (!ctx || !canvas) return;
      const { prevX, prevY, currX, currY, color: remoteColor, width: remoteWidth, shape } = data;
      const displayWidth = canvas.clientWidth || canvas.width;
      const displayHeight = canvas.clientHeight || canvas.height;
      const x1 = prevX * displayWidth;
      const y1 = prevY * displayHeight;
      const x2 = currX * displayWidth;
      const y2 = currY * displayHeight;

      if (shape && shape !== 'pen' && shape !== 'eraser') {
        drawShape(ctx, shape, x1, y1, x2, y2, remoteColor, remoteWidth);
      } else if (shape === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = remoteWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = remoteColor;
        ctx.lineWidth = remoteWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    };

    const handleClear = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleRemoteImage = (payload: { image: string; x: number; y: number; width: number; height: number }) => {
      drawImageOnCanvas(payload.image, payload.x, payload.y, payload.width, payload.height);
    };

    const handleRemoteNotes = (updatedNotes: StickyNote[]) => {
      setNotes(updatedNotes);
    };

    signaling.on('whiteboard-draw', handleRemoteDraw);
    signaling.on('whiteboard-clear', handleClear);
    signaling.on('whiteboard-image', handleRemoteImage);
    signaling.on('whiteboard-notes-update', handleRemoteNotes);

    return () => {
      resizeObserver.disconnect();
      signaling.off('whiteboard-draw', handleRemoteDraw);
      signaling.off('whiteboard-clear', handleClear);
      signaling.off('whiteboard-image', handleRemoteImage);
      signaling.off('whiteboard-notes-update', handleRemoteNotes);
    };
  }, [isOpen, drawImageOnCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e);
    startPos.current = pos;
    lastPos.current = pos;

    if (tool !== 'pen' && tool !== 'eraser') {
      snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const currentPos = getPos(e);
      const width = canvasRef.current.clientWidth || canvasRef.current.width;
      const height = canvasRef.current.clientHeight || canvasRef.current.height;

    if (tool === 'pen' || tool === 'eraser') {
      const isErasing = tool === 'eraser';
      ctx.save();
      ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = isErasing ? eraserSize : lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      signaling.emit('whiteboard-draw', {
        roomId,
        data: {
          prevX: lastPos.current.x / width,
          prevY: lastPos.current.y / height,
          currX: currentPos.x / width,
          currY: currentPos.y / height,
          color: isErasing ? 'rgba(0,0,0,1)' : color,
          width: isErasing ? eraserSize : lineWidth,
          shape: tool
        }
      });

      lastPos.current = currentPos;
    } else if (snapshotRef.current && startPos.current) {
      // Shape preview mode
      ctx.putImageData(snapshotRef.current, 0, 0);
      drawShape(ctx, tool, startPos.current.x, startPos.current.y, currentPos.x, currentPos.y, color, lineWidth);
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);

    if (tool !== 'pen' && tool !== 'eraser' && startPos.current) {
      const currentPos = getPos(e);
      const width = canvasRef.current.clientWidth || canvasRef.current.width;
      const height = canvasRef.current.clientHeight || canvasRef.current.height;

      signaling.emit('whiteboard-draw', {
        roomId,
        data: {
          prevX: startPos.current.x / width,
          prevY: startPos.current.y / height,
          currX: currentPos.x / width,
          currY: currentPos.y / height,
          color,
          width: lineWidth,
          shape: tool
        }
      });
    }

    startPos.current = null;
    lastPos.current = null;
    snapshotRef.current = null;
  };

  const clearBoard = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      signaling.emit('whiteboard-clear', { roomId });
    }
  };

  const downloadBoard = () => {
    if (!canvasRef.current) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasRef.current.width;
    exportCanvas.height = canvasRef.current.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Dark background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw drawing layer
    ctx.drawImage(canvasRef.current, 0, 0);

    // Bake in sticky notes
    notes.forEach(note => {
      const noteX = (note.x / 100) * exportCanvas.width;
      const noteY = (note.y / 100) * exportCanvas.height;
      const noteW = 160;
      const noteH = 120;

      ctx.save();
      ctx.fillStyle = note.color === 'amber' ? '#f59e0b' : note.color === 'emerald' ? '#10b981' : note.color === 'sky' ? '#0ea5e9' : note.color === 'rose' ? '#f43f5e' : '#a855f7';
      ctx.beginPath();
      ctx.roundRect(noteX, noteY, noteW, noteH, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(note.author || 'Note', noteX + 10, noteY + 20);

      ctx.font = '12px sans-serif';
      ctx.fillText(note.text || '(empty)', noteX + 10, noteY + 45, noteW - 20);
      ctx.restore();
    });

    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  // Custom cursor styling based on active tool
  const getCursorClass = () => {
    if (tool === 'eraser') return 'cursor-[cell]';
    return 'cursor-crosshair';
  };

  // Outer container styling depending on mode
  const containerClasses = mode === 'stage'
    ? "w-full h-full relative bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
    : "fixed top-16 bottom-24 inset-x-3 sm:inset-x-8 md:inset-x-16 max-w-4xl mx-auto z-40 bg-zinc-950/95 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200";

  return (
    <div className={containerClasses}>
      <div className="h-12 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-zinc-800 bg-zinc-900/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">Collaborative whiteboard</h2>
          <p className="text-[10px] text-zinc-500 truncate">Draw, add notes, and share ideas with everyone</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">
          {mode === 'stage' ? 'Docked' : 'Floating'}
        </span>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 min-w-0">
      {/* Sleek Floating Glass Toolbar */}
      <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-zinc-900/95 backdrop-blur-2xl border border-white/15 ring-1 ring-white/10 rounded-2xl p-1.5 sm:p-2 flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] z-30 max-w-[calc(100%-1rem)]">
        
        {/* Tool Selector */}
        <div className="flex items-center gap-0.5 sm:gap-1 pr-1.5 border-r border-white/10">
          <TooltipButton label="Pen (Freehand)" onClick={() => setTool('pen')} active={tool === 'pen'}>
            <PenTool className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton label="Line" onClick={() => setTool('line')} active={tool === 'line'}>
            <Minus className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton label="Arrow" onClick={() => setTool('arrow')} active={tool === 'arrow'}>
            <MoveRight className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton label="Rectangle" onClick={() => setTool('rectangle')} active={tool === 'rectangle'}>
            <Square className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton label="Circle / Ellipse" onClick={() => setTool('circle')} active={tool === 'circle'}>
            <Circle className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton label="Eraser" onClick={() => setTool('eraser')} active={tool === 'eraser'}>
            <Eraser className="w-4 h-4" />
          </TooltipButton>
        </div>

        {/* Color Palette (Active when tool !== eraser) */}
        {tool !== 'eraser' ? (
          <div className="flex items-center gap-1 px-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 ${color === c ? 'border-white scale-110 ring-2 ring-blue-500/50' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>
        ) : (
          /* Eraser Size Configurator */
          <div className="flex items-center gap-1.5 px-2 bg-white/5 rounded-xl py-0.5">
            <span className="text-[10px] text-zinc-400 font-mono font-bold uppercase">Size:</span>
            {ERASER_SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setEraserSize(s)}
                className={`px-1.5 py-0.5 text-xs rounded-lg font-mono font-semibold transition-all ${
                  eraserSize === s ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
                title={`Eraser ${s}px`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Line Width Presets (When not erasing) */}
        {tool !== 'eraser' && (
          <div className="flex items-center gap-0.5 px-1.5 border-l border-white/10">
            {LINE_WIDTHS.map(w => (
              <TooltipButton
                key={w}
                label={`Stroke ${w}px`}
                onClick={() => setLineWidth(w)}
                active={lineWidth === w}
              >
                <div 
                  className="rounded-full bg-current mx-auto" 
                  style={{ width: `${Math.max(w * 1.5, 3)}px`, height: `${Math.max(w * 1.5, 3)}px` }} 
                />
              </TooltipButton>
            ))}
          </div>
        )}

        <div className="w-px h-5 bg-white/10 mx-0.5 hidden sm:block" />

        {/* Media & Sticky Notes Controls */}
        <div className="flex items-center gap-0.5">
          {/* Upload / Paste Image Button */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <TooltipButton 
            label="Upload Image (or Ctrl+V)" 
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4 text-sky-400" />
          </TooltipButton>

          {/* Add Collaborative Sticky Note */}
          <TooltipButton 
            label="Add Sticky Note" 
            onClick={handleAddNote}
          >
            <StickyNoteIcon className="w-4 h-4 text-amber-400" />
          </TooltipButton>
        </div>

        <div className="w-px h-5 bg-white/10 mx-0.5 hidden sm:block" />

        {/* Actions (Clear, Export, Mode Switch, Close) */}
        <div className="flex items-center gap-0.5">
          <TooltipButton 
            label="Clear Canvas" 
            onClick={clearBoard}
            danger
          >
            <Trash2 className="w-4 h-4" />
          </TooltipButton>

          <TooltipButton 
            label="Download PNG & Notes" 
            onClick={downloadBoard}
          >
            <Download className="w-4 h-4" />
          </TooltipButton>

          {/* Toggle between In-Stage and Pop-up Floating Window */}
          {onToggleMode && (
            <TooltipButton 
              label={mode === 'stage' ? 'Switch to Floating Window' : 'Dock with Videos'} 
              onClick={onToggleMode}
            >
              {mode === 'stage' ? <Maximize2 className="w-4 h-4 text-blue-400" /> : <LayoutGrid className="w-4 h-4 text-emerald-400" />}
            </TooltipButton>
          )}

          <TooltipButton 
            label="Close Whiteboard" 
            onClick={onClose}
            className="text-white hover:bg-rose-500/20"
          >
            <X className="w-4 h-4" />
          </TooltipButton>
        </div>
      </div>

      {/* Synced Collaborative Sticky Notes Layer */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        {notes.map(note => {
          const colorMeta = NOTE_COLORS.find(c => c.key === note.color) || NOTE_COLORS[0];
          return (
            <div
              key={note.id}
              style={{ left: `${note.x}%`, top: `${note.y}%` }}
              className={`absolute w-44 sm:w-48 p-3 rounded-2xl shadow-2xl backdrop-blur-xl border ${colorMeta.border} ${colorMeta.bg} ${colorMeta.text} pointer-events-auto cursor-grab active:cursor-grabbing transition-shadow select-none animate-in fade-in zoom-in-90 duration-150`}
              onMouseDown={(e) => handleNoteDragStart(e, note)}
              onTouchStart={(e) => handleNoteDragStart(e, note)}
            >
              {/* Note Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-black/10 text-[10px] font-bold uppercase tracking-wider">
                <span className="truncate max-w-[100px]">{note.author || 'Sticky Note'}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCycleNoteColor(note.id); }}
                    className="w-3 h-3 rounded-full border border-black/20 hover:scale-125 transition-transform"
                    title="Change note color"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                    className="p-0.5 hover:bg-black/10 rounded"
                    title="Delete note"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Note Textarea */}
              <textarea
                value={note.text}
                onChange={(e) => handleUpdateNoteText(note.id, e.target.value)}
                placeholder="Write note here..."
                rows={3}
                className="w-full mt-2 bg-transparent resize-none outline-none text-xs font-medium placeholder-black/40 leading-relaxed"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>

      {/* Canvas Area */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
        onTouchMove={draw}
        className={`w-full h-full touch-none bg-transparent ${getCursorClass()}`}
      />
      </div>
    </div>
  );
};

export default Whiteboard;
