
import React, { useRef, useEffect, useState } from 'react';
import { Trash2, PenTool, X, Eraser, Download } from 'lucide-react';
import { signaling } from '../services/socket';
import { DrawLine } from '../types';

interface WhiteboardProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#ffffff', // White
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
];

const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [isEraser, setIsEraser] = useState(false);
  const [lineWidth, setLineWidth] = useState(3);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Resize canvas to match container while preserving content
    const resizeCanvas = () => {
        if (containerRef.current && canvas && ctx) {
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
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

            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;

            if (tempCanvas && tempCanvas.width > 0 && tempCanvas.height > 0) {
                ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
            }
        }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Socket Event Listeners
    const handleRemoteDraw = (data: DrawLine) => {
        if (!ctx) return;
        const { prevX, prevY, currX, currY, color: remoteColor, width } = data;
        
        ctx.beginPath();
        ctx.moveTo(prevX * canvas.width, prevY * canvas.height);
        ctx.lineTo(currX * canvas.width, currY * canvas.height);
        ctx.strokeStyle = remoteColor;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
    };

    const handleClear = () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    signaling.on('whiteboard-draw', handleRemoteDraw);
    signaling.on('whiteboard-clear', handleClear);

    return () => {
        window.removeEventListener('resize', resizeCanvas);
        signaling.off('whiteboard-draw', handleRemoteDraw);
        signaling.off('whiteboard-clear', handleClear);
    };
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      setIsDrawing(true);
      const pos = getPos(e);
      lastPos.current = pos;
  };

  const stopDrawing = () => {
      setIsDrawing(false);
      lastPos.current = null;
  };

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

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !lastPos.current || !canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const currentPos = getPos(e);
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      const currentColor = isEraser ? '#00000000' : color; // Eraser acts as clear in some modes, but here we paint background/clear
      // Actually for eraser in a layered canvas, we usually use destination-out, 
      // but for simplicity on a black bg app, painting black works visually or using globalCompositeOperation
      
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = isEraser ? 20 : lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Emit normalized coordinates (0-1) so it works on different screen sizes
      signaling.emit('whiteboard-draw', {
          roomId,
          data: {
              prevX: lastPos.current.x / width,
              prevY: lastPos.current.y / height,
              currX: currentPos.x / width,
              currY: currentPos.y / height,
              color: isEraser ? 'rgba(0,0,0,1)' : color, // Remote peers need to know to erase
              width: isEraser ? 20 : lineWidth
          }
      });

      lastPos.current = currentPos;
      ctx.globalCompositeOperation = 'source-over'; // Reset
  };

  const clearBoard = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      signaling.emit('whiteboard-clear', { roomId });
  };

  const downloadBoard = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
        <div ref={containerRef} className="relative w-full h-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md border border-zinc-700 rounded-2xl p-2 flex items-center gap-2 shadow-xl z-10">
                <div className="flex gap-1 pr-2 border-r border-zinc-700">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => { setColor(c); setIsEraser(false); }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c && !isEraser ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                
                <button 
                   onClick={() => setIsEraser(!isEraser)}
                   className={`p-2 rounded-xl transition-colors ${isEraser ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                   title="Eraser"
                >
                    <Eraser className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-zinc-700 mx-1"></div>

                <button 
                   onClick={clearBoard}
                   className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                   title="Clear Board"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                
                <button 
                   onClick={downloadBoard}
                   className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                   title="Save as Image"
                >
                    <Download className="w-5 h-5" />
                </button>

                <button 
                   onClick={onClose}
                   className="p-2 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700 transition-colors ml-2"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
                className="w-full h-full cursor-crosshair touch-none bg-transparent"
            />
        </div>
    </div>
  );
};

export default Whiteboard;
