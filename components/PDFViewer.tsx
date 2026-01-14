import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, FileText, AlertCircle, RefreshCw as RefreshIcon, ExternalLink } from 'lucide-react';

interface PDFViewerProps {
  fileContent: string;
  fileName: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ fileContent, fileName }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [pdfLoaded, setPdfLoaded] = useState<boolean>(false);
  const componentRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setPdfLoaded(true);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError(`PDF加载失败: ${error.message}`);
    setLoading(false);
    setUseFallback(true);
  }, []);

  const changePage = useCallback((offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      if (newPageNumber >= 1 && newPageNumber <= numPages) {
        return newPageNumber;
      }
      return prevPageNumber;
    });
  }, [numPages]);

  const changeScale = useCallback((delta: number) => {
    setScale(prevScale => {
      const newScale = prevScale + delta;
      if (newScale >= 0.5 && newScale <= 3.0) {
        return newScale;
      }
      return prevScale;
    });
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
      window.open(fileContent, '_blank');
    } catch (error) {
      console.error('Open error:', error);
      alert('打开失败');
    }
  }, [fileContent]);

  const handleFallbackClick = useCallback(() => {
    setUseFallback(false);
    setError(null);
    setLoading(true);
    setPdfLoaded(false);
  }, []);

  useEffect(() => {
    return () => {
      if (componentRef.current) {
        console.log('PDFViewer unmounting, cleaning up...');
      }
    };
  }, []);

  if (useFallback) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              PDF预览（新窗口打开）
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
              title="下载PDF"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-start gap-4 mb-6">
              <FileText size={48} className="text-blue-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  PDF文件预览
                </h3>
                <p className="text-slate-600 mb-2">
                  文件名：<span className="font-medium">{fileName}</span>
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <FileText size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 mb-1">
                        PDF文件已在新窗口中打开
                      </p>
                      <p className="text-sm text-blue-700">
                        如果没有自动打开，请检查浏览器弹窗设置
                      </p>
                      <p className="text-sm text-blue-700 mt-2">
                        <strong>提示：</strong>新窗口打开可以避免页面卡死问题
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Download size={20} />
                下载PDF文件
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !useFallback) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <AlertCircle size={64} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            PDF加载失败
          </h2>
          <p className="text-slate-600 mb-6">
            {error}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleFallbackClick}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshIcon size={18} />
              重试加载
            </button>
            <button
              onClick={() => setUseFallback(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
            >
              <FileText size={18} />
              使用降级模式
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" ref={componentRef}>
      <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1 || !pdfLoaded}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="上一页"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[80px] text-center">
            第 {pageNumber} / {numPages} 页
          </span>
          <button
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages || !pdfLoaded}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="下一页"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeScale(-0.2)}
            disabled={scale <= 0.5 || !pdfLoaded}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => changeScale(0.2)}
            disabled={scale >= 3.0 || !pdfLoaded}
            className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
        </div>

        <button
          onClick={handleDownload}
          className="p-2 rounded hover:bg-slate-200 transition-colors"
          title="下载PDF"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="animate-spin" size={24} />
              <span>加载PDF中...</span>
            </div>
          </div>
        )}
        <div className="flex justify-center">
          <iframe
            src={fileContent}
            className="shadow-lg border-0"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '800px'
            }}
            onLoad={() => {
              setLoading(false);
              setPdfLoaded(true);
              setError(null);
            }}
            onError={() => {
              setError('PDF加载失败');
              setLoading(false);
              setUseFallback(true);
            }}
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
};