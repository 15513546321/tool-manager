import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocItem, DocVersion } from '../types';
import { 
  FileText, Search, Plus, Upload, Clock, Download, Eye, X, History, Edit, Trash2, FileSpreadsheet, FileType, FileCode, Check, List, Megaphone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { recordAction } from '../services/auditService';
import { decodeBase64Content, base64ToUint8Array } from '../services/utils';
import { Database, TABLE } from '../services/database';

// Reusing DocItem structure but storing in 'announcements' key
const initialData: DocItem[] = [
  { 
    id: '1', 
    category: 'System', 
    subCategory: 'Maintenance', 
    title: '系统维护通知 2023-10-01', 
    description: '本周六凌晨将进行系统升级，预计停机2小时。',
    versions: [
      { id: 'v1', versionNumber: '1.0', fileName: 'maintenance.txt', fileContent: 'System upgrade scheduled for Sat 2AM - 4AM.', updatedAt: '2023-09-28 10:00', updatedBy: 'admin', size: '1KB' }
    ]
  }
];

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1";

interface HeadingItem { id: string; text: string; level: number; }

export const Announcement: React.FC = () => {
  const [items, setItems] = useState<DocItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', versionNumber: '1.0' });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [previewContent, setPreviewContent] = useState<{type: 'html' | 'iframe' | 'text' | 'word', content: string} | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [wordOutline, setWordOutline] = useState<HeadingItem[]>([]);

  useEffect(() => {
    const saved = Database.findAll<DocItem>(TABLE.ANNOUNCEMENTS);
    setItems(saved.length > 0 ? saved : initialData);
  }, []);

  const saveItems = (newItems: DocItem[]) => {
    setItems(newItems);
    Database.save(TABLE.ANNOUNCEMENTS, newItems);
  };

  const selectedItem = useMemo(() => items.find(d => d.id === selectedId), [items, selectedId]);
  const activeVersion = useMemo(() => {
    if (!selectedItem) return null;
    if (previewVersionId) return selectedItem.versions.find(v => v.id === previewVersionId);
    return selectedItem.versions[0];
  }, [selectedItem, previewVersionId]);

  // Record Audit Log when viewing
  useEffect(() => {
    if (selectedItem && activeVersion) {
        recordAction('View Announcement', `Viewed: ${selectedItem.title} (v${activeVersion.versionNumber})`);
    }
  }, [selectedItem, activeVersion]);

  // Preview Generation (Reused from DocRepository)
  useEffect(() => {
    const generatePreview = async () => {
      setExcelWorkbook(null);
      setCurrentSheet('');
      setWordOutline([]);
      
      if (!activeVersion) {
        setPreviewContent(null);
        return;
      }

      // Handle case with no file content
      if (!activeVersion.fileContent) {
          setPreviewContent({ type: 'text', content: '此公告无附件内容。' });
          return;
      }

      setIsPreviewLoading(true);
      const { fileName, fileContent } = activeVersion;
      const isBase64 = fileContent.startsWith('data:');
      
      try {
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
           let workbook;
           if (isBase64) {
             const base64 = fileContent.split(',')[1];
             workbook = XLSX.read(base64, { type: 'base64' });
           } else {
             setPreviewContent({ type: 'text', content: 'Preview not available for mock data.' });
             setIsPreviewLoading(false);
             return;
           }
           setExcelWorkbook(workbook);
           const firstSheet = workbook.SheetNames[0];
           setCurrentSheet(firstSheet);
           const html = XLSX.utils.sheet_to_html(workbook.Sheets[firstSheet]);
           setPreviewContent({ type: 'html', content: html });

        } else if (fileName.endsWith('.docx')) {
           if (isBase64) {
             const bytes = base64ToUint8Array(fileContent);
             
             const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
             const tempDiv = document.createElement('div');
             tempDiv.innerHTML = result.value;
             const headings: HeadingItem[] = [];
             tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((header, index) => {
                 const id = `heading-${index}`;
                 header.setAttribute('id', id);
                 headings.push({ id, text: header.textContent || '', level: parseInt(header.tagName.substring(1)) });
             });
             setWordOutline(headings);
             setPreviewContent({ type: 'word', content: tempDiv.innerHTML });
           } else {
             setPreviewContent({ type: 'text', content: 'Preview not available.' });
           }

        } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
           setPreviewContent({ type: 'iframe', content: fileContent });
        } else {
           let text = fileContent;
           if (isBase64) {
               // Use Utility to fix garbled text
               text = decodeBase64Content(fileContent);
           }
           setPreviewContent({ type: 'text', content: text });
        }
      } catch (err) {
        setPreviewContent({ type: 'text', content: 'Error generating preview.' });
      } finally {
        setIsPreviewLoading(false);
      }
    };
    generatePreview();
  }, [activeVersion]);

  // --- Handlers ---
  const handleSheetChange = (sheetName: string) => {
      if (excelWorkbook) {
          setCurrentSheet(sheetName);
          const html = XLSX.utils.sheet_to_html(excelWorkbook.Sheets[sheetName]);
          setPreviewContent({ type: 'html', content: html });
      }
  };

  const handleWordNavClick = (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async () => {
    // Logic to finalize save (called after file read or immediately if no file)
    const finalizeSubmit = (fileData: { content: string, name: string, size: string }) => {
        const newVersion: DocVersion = {
            id: Date.now().toString(),
            versionNumber: formData.versionNumber,
            fileName: fileData.name,
            fileContent: fileData.content,
            updatedAt: new Date().toLocaleString(),
            updatedBy: 'admin',
            size: fileData.size
        };

        if (selectedItem) {
            // Update existing (Add version)
            const updatedList = items.map(d => {
                if (d.id === selectedItem.id) {
                    return { ...d, versions: [newVersion, ...d.versions], title: formData.title, description: formData.description };
                }
                return d;
            });
            saveItems(updatedList);
            recordAction('Update Announcement', `Updated: ${formData.title}`);
        } else {
            // Create New
            const newItem: DocItem = {
                id: Date.now().toString(),
                category: 'Notice',
                subCategory: 'General',
                title: formData.title,
                description: formData.description,
                versions: [newVersion]
            };
            saveItems([newItem, ...items]);
            setSelectedId(newItem.id);
            recordAction('Create Announcement', `Created: ${formData.title}`);
        }
        setIsModalOpen(false);
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target?.result as string;
            finalizeSubmit({
                content: fileContent,
                name: file.name,
                size: `${(file.size / 1024).toFixed(1)}KB`
            });
        };
        reader.readAsDataURL(file);
    } else {
        // Handle no file case
        finalizeSubmit({
            content: '',
            name: '',
            size: '0KB'
        });
    }
  };

  const handleOpenCreate = () => {
      setSelectedId(null); // Clear selection implies create mode UI logic in submit if needed, but here we just toggle modal
      setFormData({ title: '', description: '', versionNumber: '1.0' });
      setFile(null);
      setIsModalOpen(true);
  };

  const handleOpenUpdate = () => {
      if(!selectedItem) return;
      setFormData({ 
          title: selectedItem.title, 
          description: selectedItem.description || '', 
          versionNumber: (parseFloat(selectedItem.versions[0].versionNumber) + 0.1).toFixed(1)
      });
      setFile(null);
      setIsModalOpen(true);
  };

  const getFileIcon = (fileName: string) => {
      if (!fileName) return <Megaphone size={18} className="text-orange-500"/>; // No file icon
      if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return <FileSpreadsheet size={18} className="text-green-600"/>;
      if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return <FileType size={18} className="text-blue-600"/>;
      return <FileText size={18} className="text-slate-500"/>;
  };

  const renderPreview = () => {
    if (isPreviewLoading) return <div className="text-center p-10 text-slate-400">Loading preview...</div>;
    if (!previewContent) return <div className="text-center p-10 text-slate-400">No content</div>;

    if (previewContent.type === 'word') {
         return (
             <div className="flex h-full gap-4 relative">
                 <div className="flex-1 overflow-auto bg-white pr-2 p-4">
                     <div className="preview-content" dangerouslySetInnerHTML={{ __html: previewContent.content }} />
                 </div>
                 {wordOutline.length > 0 && (
                     <div className="w-56 shrink-0 border-l border-slate-200 pl-4 overflow-y-auto bg-slate-50 p-2 absolute right-0 top-0 bottom-0 shadow-lg">
                         <div className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><List size={14}/> Nav</div>
                         <ul className="space-y-1">{wordOutline.map((item, idx) => (
                             <li key={idx}><button onClick={() => handleWordNavClick(item.id)} className="text-left w-full text-xs hover:text-blue-600 truncate py-0.5" style={{ paddingLeft: `${(item.level - 1) * 8}px` }}>{item.text}</button></li>
                         ))}</ul>
                     </div>
                 )}
             </div>
         );
    }

    if (previewContent.type === 'html') {
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-auto p-4"><div className="preview-content" dangerouslySetInnerHTML={{ __html: previewContent.content }} /></div>
                {excelWorkbook && (
                    <div className="mt-2 border-t pt-2 flex gap-1 overflow-x-auto pb-2 bg-slate-50 px-2">
                        {excelWorkbook.SheetNames.map(sheet => (
                            <button key={sheet} onClick={() => handleSheetChange(sheet)} className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 ${currentSheet === sheet ? 'text-green-700 border-green-600 bg-green-50' : 'text-slate-500 border-transparent'}`}>{sheet}</button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return <pre className="p-4 whitespace-pre-wrap text-sm text-slate-700">{previewContent.content}</pre>;
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar List */}
      <div className="w-80 flex flex-col border-r border-slate-200 bg-white z-10">
        <div className="p-4 border-b border-slate-100">
           <div className="flex justify-between items-center mb-4">
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                   <Megaphone size={20} className="text-red-500"/> 公告通知
               </h2>
               <button onClick={handleOpenCreate} className="bg-red-600 text-white p-1.5 rounded hover:bg-red-700"><Plus size={18}/></button>
           </div>
           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
             <input className={`${INPUT_STYLE} pl-9`} placeholder="搜索公告..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            {items.filter(i => i.title.toLowerCase().includes(searchFilter.toLowerCase())).map(item => (
                <div 
                    key={item.id} 
                    onClick={() => { setSelectedId(item.id); setPreviewVersionId(null); }}
                    className={`p-3 mb-2 rounded-lg cursor-pointer border transition-all ${selectedId === item.id ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-1">{getFileIcon(item.versions[0].fileName)}</div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-medium truncate ${selectedId === item.id ? 'text-red-900' : 'text-slate-700'}`}>{item.title}</h3>
                            <p className="text-xs text-slate-400 mt-1 truncate">{item.description}</p>
                            <span className="text-[10px] text-slate-400 block mt-1">{item.versions[0].updatedAt}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
         {selectedItem && activeVersion ? (
             <>
                <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl font-bold text-slate-900">{selectedItem.title}</h1>
                            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold">v{activeVersion.versionNumber}</span>
                        </div>
                        <div className="text-sm text-slate-500 flex gap-4">
                            <span className="flex items-center gap-1"><Clock size={14}/> {activeVersion.updatedAt}</span>
                            {activeVersion.fileName && <span className="flex items-center gap-1">{activeVersion.fileName}</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {!previewVersionId && (
                             <button onClick={handleOpenUpdate} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium"><Edit size={16}/> 更新</button>
                        )}
                        {/* Only show download if file content exists */}
                        {activeVersion.fileContent && (
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 text-sm font-medium"><Download size={16}/> 下载</button>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Preview Area */}
                    <div className="flex-1 bg-slate-100 p-6 overflow-hidden flex flex-col">
                        {selectedItem.description && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 text-slate-700">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">公告内容 / 描述</h4>
                                <p>{selectedItem.description}</p>
                            </div>
                        )}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden relative flex flex-col">
                             <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase">附件预览</div>
                             <div className="flex-1 overflow-auto">
                                {renderPreview()}
                             </div>
                        </div>
                    </div>

                    {/* History Sidebar */}
                    <div className="w-64 bg-white border-l border-slate-200 overflow-y-auto flex flex-col">
                        <div className="p-4 font-bold text-slate-700 border-b border-slate-100 flex items-center gap-2"><History size={16}/> 历史版本</div>
                        <div className="p-2">
                            {selectedItem.versions.map(v => (
                                <div key={v.id} className={`p-3 mb-2 rounded border ${activeVersion.id === v.id ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-100'}`}>
                                    <div className="flex justify-between font-bold text-sm mb-1">
                                        <span>v{v.versionNumber}</span>
                                        <span className="text-xs font-normal text-slate-400">{v.updatedAt.split(' ')[0]}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2 truncate">{v.fileName || '无附件'}</div>
                                    {activeVersion.id !== v.id && (
                                        <button onClick={() => setPreviewVersionId(v.id)} className="w-full py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex items-center justify-center gap-1"><Eye size={12}/> 查看此版本</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             </>
         ) : (
             <div className="flex-1 flex items-center justify-center text-slate-400">选择公告查看详情</div>
         )}
      </div>

      {/* Create/Update Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                  <h3 className="text-lg font-bold mb-4">{selectedItem ? '更新公告' : '发布新公告'}</h3>
                  <div className="space-y-4">
                      <div><label className={LABEL_STYLE}>标题</label><input className={INPUT_STYLE} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="请输入标题" /></div>
                      <div><label className={LABEL_STYLE}>版本号</label><input className={INPUT_STYLE} value={formData.versionNumber} onChange={e => setFormData({...formData, versionNumber: e.target.value})} placeholder="e.g. 1.0" /></div>
                      <div><label className={LABEL_STYLE}>描述 / 内容</label><textarea className={INPUT_STYLE} rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="请输入公告详细内容..." /></div>
                      <div>
                          <label className={LABEL_STYLE}>附件 (可选)</label>
                          <div className="border-2 border-dashed border-slate-300 rounded p-4 text-center cursor-pointer hover:bg-slate-50 relative">
                              <input ref={fileInputRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files?.[0] || null)} />
                              <div className="text-sm text-slate-500">{file ? file.name : '点击上传文件 (支持 word/excel/pdf/txt)'}</div>
                          </div>
                          {file && <button onClick={() => { setFile(null); if(fileInputRef.current) fileInputRef.current.value=''; }} className="text-xs text-red-500 mt-1 hover:underline">移除文件</button>}
                      </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                      <button onClick={handleSubmit} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded">保存</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};