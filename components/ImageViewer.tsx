import React, { useState, useCallback } from 'react';
import { ExternalLink, Download, Loader2, Image as ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerProps {
  fileContent: string;
  fileName: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ fileContent, fileName }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [imageUrl, setImageUrl] = useState<string>('');

  const handleDownload = useCallback(() => {
    try {
      const arr = fileContent.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('下载失败');
    }
  }, [fileContent, fileName]);

  const handleOpenInNewWindow = useCallback(() => {
    try {
      const arr = fileContent.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Open error:', error);
      alert('打开失败');
    }
  }, [fileContent]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  React.useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (fileContent.startsWith('data:')) {
          setImageUrl(fileContent);
        } else {
          throw new Error('Invalid file content format');
        }

        setLoading(false);
      } catch (err) {
        console.error('Image load error:', err);
        setError('图片文件加载失败');
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [fileContent]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <ImageIcon size={64} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            图片加载失败
          </h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download size={18} />
              下载图片
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" size={24} />
          <span>加载图片中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            图片预览
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded hover:bg-slate-200 transition-colors"
            title="重置缩放"
          >
            <span className="text-xs">100%</span>
          </button>
        </div>

        <button
          onClick={handleOpenInNewWindow}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm transition-colors"
        >
          <ExternalLink size={16} />
          新窗口打开
        </button>
        <button
          onClick={handleDownload}
          className="p-2 rounded hover:bg-slate-200 transition-colors"
          title="下载图片"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
        <div className="relative">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain shadow-lg"
            style={{
              transform: `scale(${scale})`,
              transition: 'transform 0.2s ease-in-out'
            }}
          />
        </div>
      </div>
    </div>
  );
};