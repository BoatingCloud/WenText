import { useEffect, useRef, useState, useCallback } from 'react';

interface SignaturePadProps {
  width?: number;
  height?: number;
  onConfirm?: (dataUrl: string) => void;
  onClear?: () => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  width = 400,
  height = 200,
  onConfirm,
  onClear,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [getCtx, width, height]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    setHasContent(false);
    onClear?.();
  };

  const handleConfirm = () => {
    if (!hasContent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm?.(dataUrl);
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          cursor: 'crosshair',
          touchAction: 'none',
          display: 'block',
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: '4px 16px',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          清除
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasContent}
          style={{
            padding: '4px 16px',
            border: '1px solid #1677ff',
            borderRadius: 4,
            background: hasContent ? '#1677ff' : '#f5f5f5',
            color: hasContent ? '#fff' : '#999',
            cursor: hasContent ? 'pointer' : 'not-allowed',
          }}
        >
          确认签名
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
