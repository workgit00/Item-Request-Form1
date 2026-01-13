import React, { useRef, useEffect, useState } from 'react';
import { X, Upload, PenTool } from 'lucide-react';

const ApproverSignature = ({ 
  value, 
  onChange, 
  disabled = false, 
  approverName = '',
  approverTitle = '',
  label = 'Signature'
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(value || '');

  useEffect(() => {
    if (value !== signatureData) {
      setSignatureData(value || '');
      if (value && canvasRef.current) {
        loadSignatureToCanvas(value);
      } else if (!value && canvasRef.current) {
        clearCanvas();
      }
    }
  }, [value]);

  useEffect(() => {
    if (signatureData && canvasRef.current) {
      loadSignatureToCanvas(signatureData);
    }
  }, []);

  const loadSignatureToCanvas = (base64Data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const imgWidth = Math.min(img.width, canvas.width);
      const imgHeight = Math.min(img.height, canvas.height);
      const x = (canvas.width - imgWidth) / 2;
      const y = (canvas.height - imgHeight) / 2;
      ctx.drawImage(img, x, y, imgWidth, imgHeight);
    };
    img.src = base64Data;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    onChange('');
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCoordinates(e);
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    
    requestAnimationFrame(() => {
      const dataURL = canvas.toDataURL('image/png');
      setSignatureData(dataURL);
      onChange(dataURL);
    });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignature();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataURL = canvas.toDataURL('image/png');
    setSignatureData(dataURL);
    onChange(dataURL);
  };

  const handleFileUpload = (e) => {
    if (disabled) return;
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setSignatureData(base64);
      onChange(base64);
      loadSignatureToCanvas(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="w-full">
      <div className="border-2 border-gray-400 rounded p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-gray-700">
            {label}
          </label>
          {!disabled && (
            <div className="flex items-center space-x-2">
              <label className="flex items-center px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                <Upload className="h-3 w-3 mr-1" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {signatureData && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="border border-gray-300 rounded bg-gray-50 p-2">
          <canvas
            ref={canvasRef}
            width={500}
            height={120}
            className={`w-full border border-gray-300 rounded bg-white cursor-${disabled ? 'default' : 'crosshair'}`}
            style={{ maxHeight: '120px' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        
        {!disabled && !signatureData && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            <PenTool className="h-3 w-3 inline mr-1" />
            Draw your signature above or upload an image
          </p>
        )}
      </div>
      
      {/* Display signature in view mode */}
      {disabled && signatureData && (
        <div className="mt-2 border-b-2 border-gray-400 pb-2 pt-2 min-h-[60px]">
          <img 
            src={signatureData} 
            alt={`${approverName} Signature`} 
            className="h-auto max-h-16 mx-auto"
            style={{ maxWidth: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  );
};

export default ApproverSignature;
