import React, { useCallback, useEffect } from 'react';
import { Download, FileText, ExternalLink } from 'lucide-react';

interface PDFViewerProps {
  fileContent: string;
  fileName: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ fileContent, fileName }) => {
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

  // Auto open in new window when component mounts
  useEffect(() => {
    handleOpenInNewWindow();
  }, [handleOpenInNewWindow]);

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
};