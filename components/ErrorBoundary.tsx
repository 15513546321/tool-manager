import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-50">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-4">
              <AlertCircle size={64} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              预览组件加载失败
            </h2>
            <p className="text-slate-600 mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>可能的原因：</strong>
              </p>
              <ul className="text-sm text-yellow-700 list-disc list-inside mt-2 space-y-1">
                <li>PDF文件过大导致内存不足</li>
                <li>PDF文件格式不支持或损坏</li>
                <li>网络连接问题</li>
              </ul>
            </div>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={18} />
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}