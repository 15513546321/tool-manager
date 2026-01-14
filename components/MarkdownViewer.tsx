import React, { useState, useCallback } from 'react';
import { ExternalLink, Download, Loader2, FileText } from 'lucide-react';

interface MarkdownViewerProps {
  fileContent: string;
  fileName: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ fileContent, fileName }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>('');

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

  React.useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let text = fileContent;
        if (fileContent.startsWith('data:')) {
          const arr = fileContent.split(',');
          const bstr = atob(arr[1]);
          text = bstr;
        }

        setMarkdown(text);
        setLoading(false);
      } catch (err) {
        console.error('Markdown load error:', err);
        setError('Markdown文件加载失败');
        setLoading(false);
      }
    };

    loadMarkdown();
  }, [fileContent]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <FileText size={64} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Markdown加载失败
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
          <span>加载Markdown中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            Markdown预览
          </span>
        </div>
        <div className="flex items-center gap-2">
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
            title="下载文件"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
          <div 
            className="prose prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: markdown.replace(/\n/g, '<br />') }}
          />
        </div>
      </div>
    </div>
  );
};