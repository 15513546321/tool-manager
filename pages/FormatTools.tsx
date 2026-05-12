import React, { useState, useEffect } from 'react';
import { FileJson, FileCode, Copy, Eraser, Check } from 'lucide-react';

export const FormatTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'json' | 'xml'>('json');
  const [inputContent, setInputContent] = useState('');
  const [outputContent, setOutputContent] = useState('');
  const [copied, setCopied] = useState(false);

  const formatJson = (text: string) => {
    try {
      // 使用reviver函数检测重复key
      const seenKeys = new Set<string>();
      const obj = JSON.parse(text, (key, value) => {
        if (key !== '' && seenKeys.has(key)) {
          console.warn(`Warning: Duplicate key "${key}" detected, only the last value will be preserved`);
        }
        seenKeys.add(key);
        return value;
      });
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return `Error: Invalid JSON\n${(e as Error).message}`;
    }
  };

  const formatXml = (xml: string) => {
    try {
      // 移除多余的空白和换行
      let cleaned = xml.replace(/>\s+</g, '><');
      cleaned = cleaned.replace(/^\s+|\s+$/g, '');
      
      let formatted = '';
      const reg = /(>)(<)(\/*)/g;
      const spacedXml = cleaned.replace(reg, '$1\n$2$3');
      let pad = 0;
      
      spacedXml.split('\n').forEach((node) => {
        // 跳过空行
        if (!node.trim()) return;
        
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
          // 自闭合标签或单行标签对 <tag>content</tag>
          indent = 0;
        } else if (node.match(/^<\/\w/)) {
          // 结束标签 </tag>
          if (pad !== 0) pad -= 1;
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
          // 开始标签 <tag> 但没有在同一行结束
          indent = 1;
        } else {
          indent = 0;
        }

        let padding = '';
        for (let i = 0; i < pad; i++) {
          padding += '  '; // 使用2个空格缩进
        }

        formatted += padding + node.trim() + '\n';
        pad += indent;
      });
      return formatted.trim();
    } catch (e) {
        return "Error formatting XML";
    }
  };

  const handleFormat = () => {
    if (!inputContent.trim()) return;
    
    if (activeTab === 'json') {
      setOutputContent(formatJson(inputContent));
    } else {
      setOutputContent(formatXml(inputContent));
    }
  };

  // 切换标签时自动重新格式化
  useEffect(() => {
    if (inputContent.trim()) {
      handleFormat();
    }
  }, [activeTab]);

  const handleCopy = async () => {
    if (!outputContent.trim()) {
      return;
    }
    
    try {
      await navigator.clipboard.writeText(outputContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = outputContent;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Failed to copy:', e);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleTabChange = (tab: 'json' | 'xml') => {
    setActiveTab(tab);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">数据格式化工具</h2>
        <p className="text-slate-500 text-sm mt-1">支持 JSON 和 XML 的美化与验证</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => handleTabChange('json')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'json'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileJson size={18} />
            JSON 格式化
          </button>
          <button
            onClick={() => handleTabChange('xml')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'xml'
                ? 'border-orange-600 text-orange-600 bg-orange-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileCode size={18} />
            XML 格式化
          </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
          {/* Input */}
          <div className="flex-1 flex flex-col p-4 bg-slate-50/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">原始数据 (Raw)</span>
              <button 
                onClick={() => { setInputContent(''); setOutputContent(''); }}
                className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-xs"
              >
                <Eraser size={12} /> 清空
              </button>
            </div>
            <textarea
              className="flex-1 w-full p-4 border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none bg-white text-slate-700 leading-relaxed"
              placeholder={`Paste your ${activeTab.toUpperCase()} here...`}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
            />
          </div>

          {/* Controls */}
          <div className="p-4 bg-white flex md:flex-col justify-center items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 z-10">
             <button 
               onClick={handleFormat}
               className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${activeTab === 'json' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'}`}
             >
               格式化 &rarr;
             </button>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col p-4 bg-slate-50/30">
             <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">结果 (Result)</span>
              <button 
                onClick={handleCopy}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${copied ? 'text-green-600' : 'text-slate-500 hover:text-blue-600'}`}
              >
                {copied ? <Check size={12}/> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy Result'}
              </button>
            </div>
            <pre className="flex-1 w-full p-4 border border-slate-200 rounded-lg font-mono text-sm bg-slate-800 text-blue-100 overflow-auto whitespace-pre leading-relaxed">
              {outputContent || <span className="text-slate-600 italic">// Formatted result will appear here</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};