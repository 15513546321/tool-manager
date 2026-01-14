import React, { useState, useCallback } from 'react';
import { ExternalLink, Download, Loader2, FileCode, ZoomIn, ZoomOut } from 'lucide-react';

interface CodeViewerProps {
  fileContent: string;
  fileName: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ fileContent, fileName }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [scale, setScale] = useState<number>(1.0);

  const detectLanguage = useCallback((fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop();
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'java': 'java',
      'py': 'python',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'sql': 'sql',
      'sh': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown',
      'txt': 'plaintext'
    };
    return langMap[ext || 'plaintext'];
  }, []);

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
    setScale(prev => Math.min(prev + 0.1, 2.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  React.useEffect(() => {
    const loadCode = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let text = fileContent;
        if (fileContent.startsWith('data:')) {
          const arr = fileContent.split(',');
          const bstr = atob(arr[1]);
          text = bstr;
        }

        setCode(text);
        setLanguage(detectLanguage(fileName));
        setLoading(false);
      } catch (err) {
        console.error('Code load error:', err);
        setError('代码文件加载失败');
        setLoading(false);
      }
    };

    loadCode();
  }, [fileContent, fileName]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <FileCode size={64} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            代码加载失败
          </h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download size={18} />
              下载文件
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
          <span>加载代码中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            代码预览 ({language})
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
            disabled={scale >= 2.0}
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
          title="下载代码"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm p-6 h-full">
          <pre
            className="overflow-auto"
            style={{
              fontSize: `${14 * scale}px`,
              lineHeight: '1.6',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            <code className="text-slate-800">{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};