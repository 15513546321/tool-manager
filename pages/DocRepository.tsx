import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocItem, DocVersion } from '../types';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Clock, 
  Download, 
  Eye, 
  MoreVertical, 
  File, 
  X,
  History,
  Edit,
  Save,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
  FileType,
  FileCode,
  Check,
  List,
  AlignLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { recordAction } from '../services/auditService';
import { decodeBase64Content, base64ToUint8Array } from '../services/utils';
import { Database, TABLE } from '../services/database';
import { ConfirmModal } from '../components/ConfirmModal';

// --- Mock Data ---
const initialDocs: DocItem[] = [
  { 
    id: '1', 
    category: '技术规范', 
    subCategory: '后端开发', 
    title: 'Java 编码规范 v2.0', 
    description: '公司统一 Java 后端开发风格指南',
    versions: [
      { id: 'v2', versionNumber: '2.0', fileName: 'java_style_v2.md', fileContent: '# Java Style Guide v2\n\n1. Naming\n2. Formatting...', updatedAt: '2023-10-01 10:00', updatedBy: 'admin', size: '12KB' },
      { id: 'v1', versionNumber: '1.0', fileName: 'java_style_v1.md', fileContent: '# Java Style Guide v1\n\nInitial release.', updatedAt: '2023-01-15 09:30', updatedBy: 'admin', size: '10KB' }
    ]
  },
  { 
    id: '2', 
    category: '技术规范', 
    subCategory: '前端开发', 
    title: 'React 组件库使用手册', 
    description: '内部 UI 组件库 API 文档',
    versions: [
      { id: 'v1', versionNumber: '1.0', fileName: 'ui_lib.md', fileContent: '# UI Lib\n\n## Button\n...', updatedAt: '2023-09-20 14:00', updatedBy: 'user', size: '5KB' }
    ]
  },
  { 
    id: '3', 
    category: '业务文档', 
    subCategory: '支付中心', 
    title: '支付网关接入流程', 
    description: '商户接入支付网关的标准流程',
    versions: [
      { id: 'v1', versionNumber: '1.0', fileName: 'pay_flow.txt', fileContent: 'Flow:\n1. Sign contract\n2. Get keys...', updatedAt: '2023-10-05 11:20', updatedBy: 'admin', size: '2KB' }
    ]
  }
];

const DEFAULT_CATEGORIES = {
  '技术规范': ['后端开发', '前端开发', '运维部署'],
  '业务文档': ['支付中心', '用户中心', '订单中心'],
  '项目管理': ['需求文档', '会议纪要']
};

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const INLINE_INPUT_STYLE = "w-full px-2 py-1 border border-slate-200 rounded bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none text-xs text-slate-700 transition-all";
const LABEL_STYLE = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export const DocRepository: React.FC = () => {
  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>(() => {
    const saved = Database.findObject<Record<string, string[]>>(TABLE.DOC_CATEGORIES);
    return saved || DEFAULT_CATEGORIES;
  });
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'update'>('create');
  
  // Category Manager Modal
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [selectedCatForEdit, setSelectedCatForEdit] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newSubCatName, setNewSubCatName] = useState('');
  
  // Editing State for Categories
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');
  const [editingSubCat, setEditingSubCat] = useState<string | null>(null);
  const [editSubCatValue, setEditSubCatValue] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    subCategory: '',
    description: '',
    versionNumber: '1.0',
    updateType: 'new' as 'new' | 'overwrite', // for update mode
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [previewContent, setPreviewContent] = useState<{type: 'html' | 'iframe' | 'text' | 'word', content: string} | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  
  // Excel Specific State
  const [excelWorkbook, setExcelWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [currentSheet, setCurrentSheet] = useState<string>('');

  // Word Specific State
  const [wordOutline, setWordOutline] = useState<HeadingItem[]>([]);

  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
      type?: 'danger' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Init Data from DB
  useEffect(() => {
      const savedDocs = Database.findAll<DocItem>(TABLE.DOCS);
      if (savedDocs.length > 0) {
          setDocs(savedDocs);
      } else {
          setDocs(initialDocs);
      }
  }, []);

  const saveDocs = (newDocs: DocItem[]) => {
      setDocs(newDocs);
      Database.save(TABLE.DOCS, newDocs);
  };

  // Derived Data
  const filteredDocs = useMemo(() => {
    // 如果有搜索关键词，则在全部文档中进行模糊匹配
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      return docs.filter(d => {
        const matchTitle = d.title.toLowerCase().includes(searchLower);
        const matchDesc = d.description?.toLowerCase().includes(searchLower) || false;
        const matchCategory = d.category.toLowerCase().includes(searchLower);
        const matchSubCategory = d.subCategory.toLowerCase().includes(searchLower);
        // 模糊匹配：标题、描述、分类、子分类任意一个包含搜索词即可
        return matchTitle || matchDesc || matchCategory || matchSubCategory;
      });
    }
    
    // 无搜索词时按分类和子分类筛选
    return docs.filter(d => {
      const matchCat = categoryFilter ? d.category === categoryFilter : true;
      const matchSub = subCategoryFilter ? d.subCategory === subCategoryFilter : true;
      return matchCat && matchSub;
    });
  }, [docs, categoryFilter, subCategoryFilter, searchFilter]);

  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDocs.slice(start, start + itemsPerPage);
  }, [filteredDocs, currentPage]);

  const selectedDoc = useMemo(() => docs.find(d => d.id === selectedDocId), [docs, selectedDocId]);
  const activeVersion = useMemo(() => {
    if (!selectedDoc) return null;
    if (previewVersionId) return selectedDoc.versions.find(v => v.id === previewVersionId);
    return selectedDoc.versions[0]; // Default to latest
  }, [selectedDoc, previewVersionId]);

  // Record Log when viewing document
  useEffect(() => {
    if (selectedDoc && activeVersion) {
        recordAction('View Knowledge Doc', `Viewed: ${selectedDoc.title} (v${activeVersion.versionNumber})`);
    }
  }, [selectedDoc, activeVersion]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, subCategoryFilter, searchFilter]);

  // Generate Preview
  useEffect(() => {
    const generatePreview = async () => {
      setExcelWorkbook(null);
      setCurrentSheet('');
      setWordOutline([]);
      
      if (!activeVersion) {
        setPreviewContent(null);
        return;
      }

      setIsPreviewLoading(true);
      const { fileName, fileContent } = activeVersion;
      const isBase64 = fileContent.startsWith('data:');
      
      try {
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
           // Excel Preview
           let workbook;
           if (isBase64) {
             const base64 = fileContent.split(',')[1];
             workbook = XLSX.read(base64, { type: 'base64' });
           } else {
             setPreviewContent({ type: 'text', content: 'Cannot preview mock Excel file without base64 data.' });
             setIsPreviewLoading(false);
             return;
           }
           
           setExcelWorkbook(workbook);
           const firstSheet = workbook.SheetNames[0];
           setCurrentSheet(firstSheet);
           const html = XLSX.utils.sheet_to_html(workbook.Sheets[firstSheet]);
           setPreviewContent({ type: 'html', content: html });

        } else if (fileName.endsWith('.docx')) {
           // Word Preview
           if (isBase64) {
             const bytes = base64ToUint8Array(fileContent);
             
             const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
             let rawHtml = result.value;

             // Process HTML to add IDs and build outline
             const tempDiv = document.createElement('div');
             tempDiv.innerHTML = rawHtml;
             const headings: HeadingItem[] = [];
             
             const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
             headers.forEach((header, index) => {
                 const id = `heading-${index}`;
                 header.setAttribute('id', id);
                 headings.push({
                     id,
                     text: header.textContent || '',
                     level: parseInt(header.tagName.substring(1))
                 });
             });
             
             setWordOutline(headings);
             setPreviewContent({ type: 'word', content: tempDiv.innerHTML });
           } else {
             setPreviewContent({ type: 'text', content: 'Cannot preview mock Word file.' });
           }

        } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
           // HTML Preview (Iframe)
           setPreviewContent({ type: 'iframe', content: fileContent });

        } else if (fileName.endsWith('.xml') || fileName.endsWith('.json')) {
           // Code Preview
           let text = fileContent;
           if (isBase64) {
             text = decodeBase64Content(fileContent);
           }
           setPreviewContent({ type: 'text', content: text });

        } else {
           // Text/Markdown/Code Fallback
           let text = fileContent;
           if (isBase64) {
             // Use Utility to fix garbled text
             text = decodeBase64Content(fileContent);
           }
           setPreviewContent({ type: 'text', content: text });
        }
      } catch (err) {
        console.error("Preview Error", err);
        setPreviewContent({ type: 'text', content: `Error generating preview: ${err instanceof Error ? err.message : 'Unknown error'}` });
      } finally {
        setIsPreviewLoading(false);
      }
    };

    generatePreview();
  }, [activeVersion]);

  // --- Handlers ---

  const handleSheetChange = (sheetName: string) => {
      if (excelWorkbook && excelWorkbook.Sheets[sheetName]) {
          setCurrentSheet(sheetName);
          const html = XLSX.utils.sheet_to_html(excelWorkbook.Sheets[sheetName]);
          setPreviewContent({ type: 'html', content: html });
      }
  };

  const handleWordNavClick = (id: string) => {
      const el = document.getElementById(id);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
  };

  const handleCategorySave = (newMap: Record<string, string[]>) => {
    setCategoryMap(newMap);
    Database.saveObject(TABLE.DOC_CATEGORIES, newMap);
  };

  const handleAddCategory = () => {
    if (newCatName && !categoryMap[newCatName]) {
      const newMap = { ...categoryMap, [newCatName]: [] };
      handleCategorySave(newMap);
      setNewCatName('');
    }
  };

  const handleDeleteCategory = (cat: string) => {
    // Check association
    const hasLinkedDocs = docs.some(d => d.category === cat);
    if (hasLinkedDocs) {
        const count = docs.filter(d => d.category === cat).length;
        // Keep alert here as informational blocker, usually alert works better than confirm in strict env
        alert(`无法删除：该分类下有 ${count} 个文档。请先修改或删除这些文档。`);
        return;
    }

    setConfirmState({
        isOpen: true,
        title: '删除大类',
        message: `确定要删除大类 "${cat}" 吗?`,
        type: 'danger',
        onConfirm: () => {
            const { [cat]: removed, ...rest } = categoryMap;
            handleCategorySave(rest);
            if (selectedCatForEdit === cat) setSelectedCatForEdit(null);
        }
    });
  };

  const handleRenameCategory = (oldName: string) => {
      if (!editCatValue || editCatValue === oldName) {
          setEditingCat(null);
          return;
      }
      if (categoryMap[editCatValue]) {
          alert('该分类名称已存在');
          return;
      }

      setConfirmState({
          isOpen: true,
          title: '重命名分类',
          message: `确定要将 "${oldName}" 重命名为 "${editCatValue}" 吗? 这将更新所有关联文档。`,
          onConfirm: () => {
              // Update Map Keys
              const { [oldName]: subs, ...rest } = categoryMap;
              const newMap = { ...rest, [editCatValue]: subs };
              handleCategorySave(newMap);

              // Update Docs
              const updatedDocs = docs.map(d => d.category === oldName ? { ...d, category: editCatValue } : d);
              saveDocs(updatedDocs);

              if (selectedCatForEdit === oldName) setSelectedCatForEdit(editCatValue);
              setEditingCat(null);
          }
      });
  };

  const handleAddSubCategory = () => {
    if (selectedCatForEdit && newSubCatName && !categoryMap[selectedCatForEdit].includes(newSubCatName)) {
      const updatedList = [...categoryMap[selectedCatForEdit], newSubCatName];
      const newMap = { ...categoryMap, [selectedCatForEdit]: updatedList };
      handleCategorySave(newMap);
      setNewSubCatName('');
    }
  };

  const handleDeleteSubCategory = (cat: string, sub: string) => {
    // Check association
    const hasLinkedDocs = docs.some(d => d.category === cat && d.subCategory === sub);
    if (hasLinkedDocs) {
        const count = docs.filter(d => d.category === cat && d.subCategory === sub).length;
        alert(`无法删除：该分类下有 ${count} 个文档。请先修改或删除这些文档。`);
        return;
    }
    
    setConfirmState({
        isOpen: true,
        title: '删除小类',
        message: `确定要删除小类 "${sub}" 吗?`,
        type: 'danger',
        onConfirm: () => {
            const updatedList = categoryMap[cat].filter(s => s !== sub);
            const newMap = { ...categoryMap, [cat]: updatedList };
            handleCategorySave(newMap);
        }
    });
  };

  const handleRenameSubCategory = (cat: string, oldSub: string) => {
      if (!editSubCatValue || editSubCatValue === oldSub) {
          setEditingSubCat(null);
          return;
      }
      if (categoryMap[cat].includes(editSubCatValue)) {
          alert('该小类名称已存在');
          return;
      }

      setConfirmState({
          isOpen: true,
          title: '重命名小类',
          message: `确定要将 "${oldSub}" 重命名为 "${editSubCatValue}" 吗? 这将更新所有关联文档。`,
          onConfirm: () => {
              // Update Map List
              const updatedList = categoryMap[cat].map(s => s === oldSub ? editSubCatValue : s);
              const newMap = { ...categoryMap, [cat]: updatedList };
              handleCategorySave(newMap);

              // Update Docs
              const updatedDocs = docs.map(d => (d.category === cat && d.subCategory === oldSub) ? { ...d, subCategory: editSubCatValue } : d);
              saveDocs(updatedDocs);
              
              setEditingSubCat(null);
          }
      });
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setFormData({
      title: '',
      category: '',
      subCategory: '',
      description: '',
      versionNumber: '1.0',
      updateType: 'new'
    });
    setFile(null);
    setIsModalOpen(true);
  };

  const handleOpenUpdate = () => {
    if (!selectedDoc) return;
    setModalMode('update');
    setFormData({
      title: selectedDoc.title,
      category: selectedDoc.category,
      subCategory: selectedDoc.subCategory,
      description: selectedDoc.description || '',
      versionNumber: (parseFloat(selectedDoc.versions[0].versionNumber) + 0.1).toFixed(1),
      updateType: 'new'
    });
    setFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!file && modalMode === 'create') {
      alert('Please upload a file');
      return;
    }

    let fileContent = '';
    let fileSize = '';
    
    if (file) {
      // Read as DataURL (Base64) for all files to support binaries
      fileSize = `${(file.size / 1024).toFixed(1)}KB`;
      const reader = new FileReader();
      fileContent = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    } else if (modalMode === 'update' && formData.updateType === 'overwrite' && selectedDoc) {
      fileContent = selectedDoc.versions[0].fileContent;
      fileSize = selectedDoc.versions[0].size;
    }

    const newVersion: DocVersion = {
      id: Date.now().toString(),
      versionNumber: formData.versionNumber,
      fileName: file ? file.name : (selectedDoc?.versions[0].fileName || 'unknown'),
      fileContent,
      updatedAt: new Date().toLocaleString(),
      updatedBy: 'admin',
      size: fileSize
    };

    if (modalMode === 'create') {
      const newDoc: DocItem = {
        id: Date.now().toString(),
        title: formData.title,
        category: formData.category,
        subCategory: formData.subCategory,
        description: formData.description,
        versions: [newVersion]
      };
      saveDocs([newDoc, ...docs]);
      setSelectedDocId(newDoc.id);
      recordAction('Create Knowledge Doc', `Created: ${formData.title}`);
    } else if (modalMode === 'update' && selectedDoc) {
      const updatedDocs = docs.map(d => {
        if (d.id === selectedDoc.id) {
          let updatedVersions = [...d.versions];
          if (formData.updateType === 'overwrite') {
             updatedVersions[0] = { ...newVersion, versionNumber: updatedVersions[0].versionNumber };
          } else {
             updatedVersions = [newVersion, ...updatedVersions];
          }
          return {
            ...d,
            title: formData.title,
            category: formData.category,
            subCategory: formData.subCategory,
            description: formData.description,
            versions: updatedVersions
          };
        }
        return d;
      });
      saveDocs(updatedDocs);
      recordAction('Update Knowledge Doc', `Updated: ${formData.title}`);
    }

    setIsModalOpen(false);
  };

  const handleDownload = (v: DocVersion) => {
    let blob;
    if (v.fileContent.startsWith('data:')) {
       // Base64
       const arr = v.fileContent.split(',');
       const mime = arr[0].match(/:(.*?);/)?.[1];
       const bstr = atob(arr[1]);
       let n = bstr.length;
       const u8arr = new Uint8Array(n);
       while(n--){
           u8arr[n] = bstr.charCodeAt(n);
       }
       blob = new Blob([u8arr], {type:mime});
    } else {
       // Plain Text
       blob = new Blob([v.fileContent], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = v.fileName;
    a.click();
    URL.revokeObjectURL(url);
    recordAction('Download Knowledge Doc', `Downloaded: ${v.fileName}`);
  };

  const getFileIcon = (fileName: string) => {
      if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) return <FileSpreadsheet size={14} className="text-green-600"/>;
      if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) return <FileType size={14} className="text-blue-600"/>;
      if (fileName.endsWith('.xml') || fileName.endsWith('.html')) return <FileCode size={14} className="text-orange-600"/>;
      return <FileText size={14} className="text-slate-500"/>;
  };

  const renderPreview = () => {
      if (isPreviewLoading) {
          return (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                Generating preview...
            </div>
          );
      }
      
      if (!previewContent) return <div className="text-slate-400 italic">No content available</div>;

      const ContentWrapper = ({children}: {children: React.ReactNode}) => (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
                <div 
                    className="preview-content font-sans text-slate-800 leading-relaxed p-2"
                    dangerouslySetInnerHTML={{ __html: previewContent.content }}
                />
            </div>
            {/* Excel Tabs */}
            {excelWorkbook && (
                <div className="mt-2 border-t border-slate-200 pt-2 flex gap-1 overflow-x-auto pb-2">
                    {excelWorkbook.SheetNames.map(sheet => (
                        <button
                            key={sheet}
                            onClick={() => handleSheetChange(sheet)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                                currentSheet === sheet 
                                    ? 'text-green-700 border-green-600 bg-green-50' 
                                    : 'text-slate-500 border-transparent hover:bg-slate-50'
                            }`}
                        >
                            {sheet}
                        </button>
                    ))}
                </div>
            )}
        </div>
      );

      if (previewContent.type === 'iframe') {
          return (
              <iframe 
                src={previewContent.content}
                className="w-full h-full min-h-[600px] border-none bg-white"
                title="Preview"
                sandbox="allow-scripts"
              />
          );
      }

      if (previewContent.type === 'html') {
          return <ContentWrapper>{null}</ContentWrapper>;
      }

      if (previewContent.type === 'word') {
         return (
             <div className="flex h-full gap-4">
                 <div className="flex-1 overflow-auto bg-white pr-2">
                     <div 
                        className="preview-content font-sans text-slate-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: previewContent.content }}
                     />
                 </div>
                 {/* Word TOC Sidebar */}
                 {wordOutline.length > 0 && (
                     <div className="w-56 shrink-0 border-l border-slate-200 pl-4 overflow-y-auto">
                         <div className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                             <List size={14}/>
                             Navigation
                         </div>
                         <ul className="space-y-1">
                             {wordOutline.map((item, idx) => (
                                 <li key={idx}>
                                     <button 
                                         onClick={() => handleWordNavClick(item.id)}
                                         className={`text-left w-full text-xs hover:text-blue-600 hover:underline py-0.5 truncate text-slate-600`}
                                         style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                                         title={item.text}
                                     >
                                         {item.text}
                                     </button>
                                 </li>
                             ))}
                         </ul>
                     </div>
                 )}
             </div>
         );
      }

      return (
        <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
           {previewContent.content}
        </pre>
      );
  };

  return (
    <div className="flex h-full bg-slate-50">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
      />

      {/* Left Sidebar: List & Filters */}
      <div className="w-96 flex flex-col border-r border-slate-200 bg-white shadow-sm z-10">
        {/* Header / Filter Area */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
           <div className="flex items-center justify-between">
             <h2 className="text-xl font-bold text-slate-800">知识库</h2>
             <div className="flex gap-2">
               <button 
                 onClick={() => setIsCatManagerOpen(true)}
                 className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                 title="Manage Categories"
               >
                 <Settings size={18} />
               </button>
               <button 
                 onClick={handleOpenCreate}
                 className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow-sm transition-colors"
                 title="Upload Document"
               >
                 <Plus size={18} />
               </button>
             </div>
           </div>
           
           <div className="grid grid-cols-2 gap-2">
             <select 
               className={INPUT_STYLE} 
               value={categoryFilter}
               onChange={e => { setCategoryFilter(e.target.value); setSubCategoryFilter(''); }}
             >
               <option value="">所有大类</option>
               {Object.keys(categoryMap).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select 
               className={INPUT_STYLE}
               value={subCategoryFilter}
               onChange={e => setSubCategoryFilter(e.target.value)}
             >
                <option value="">所有小类</option>
                {categoryFilter && categoryMap[categoryFilter]?.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>

           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
             <input 
               className={INPUT_STYLE + " pl-9"}
               placeholder="搜索文档..."
               value={searchFilter}
               onChange={e => setSearchFilter(e.target.value)}
             />
           </div>
        </div>

        {/* List Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
          {paginatedDocs.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">暂无文档</div>
          ) : (
            paginatedDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => { setSelectedDocId(doc.id); setPreviewVersionId(null); }}
                className={`w-full text-left p-3 rounded-lg border transition-all group ${
                  selectedDocId === doc.id 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-2 rounded-lg ${selectedDocId === doc.id ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    {getFileIcon(doc.versions[0].fileName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${selectedDocId === doc.id ? 'text-blue-900' : 'text-slate-700'}`}>
                      {doc.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                       <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{doc.category}</span>
                       <span>•</span>
                       <span>{doc.subCategory}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-sm">
           <button 
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
             disabled={currentPage === 1}
             className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500"
           >
             <ChevronLeft size={18} />
           </button>
           <span className="text-slate-600 font-medium text-xs">
             Page {currentPage} of {Math.max(1, totalPages)}
           </span>
           <button 
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
             disabled={currentPage === totalPages || totalPages === 0}
             className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500"
           >
             <ChevronRight size={18} />
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        {selectedDoc && activeVersion ? (
           <>
             {/* Header */}
             <div className="bg-white px-8 py-6 border-b border-slate-200 shadow-sm flex justify-between items-start">
               <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-slate-900">{selectedDoc.title}</h1>
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold border border-green-200">
                      v{activeVersion.versionNumber}
                    </span>
                    {previewVersionId && (
                       <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">
                         <History size={10} /> 历史预览
                       </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">{getFileIcon(activeVersion.fileName)} {activeVersion.fileName}</span>
                    <span className="flex items-center gap-1"><Clock size={14}/> {activeVersion.updatedAt}</span>
                    <span className="flex items-center gap-1">by {activeVersion.updatedBy}</span>
                  </div>
                  {selectedDoc.description && (
                    <p className="mt-3 text-slate-600 text-sm max-w-2xl">{selectedDoc.description}</p>
                  )}
               </div>
               <div className="flex gap-3">
                 <button 
                   onClick={() => handleDownload(activeVersion)}
                   className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
                 >
                   <Download size={16} /> 下载
                 </button>
                 {!previewVersionId && (
                   <button 
                     onClick={handleOpenUpdate}
                     className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
                   >
                     <Edit size={16} /> 更新/修改
                   </button>
                 )}
               </div>
             </div>

             <div className="flex-1 flex overflow-hidden">
                {/* Preview */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[600px] w-full max-w-6xl mx-auto h-full flex flex-col">
                    {renderPreview()}
                  </div>
                </div>

                {/* Right Sidebar: History */}
                <div className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <History size={16} /> 版本历史
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                     {selectedDoc.versions.map((v, idx) => (
                       <div 
                         key={v.id} 
                         className={`p-3 rounded-lg mb-2 border transition-all ${
                            activeVersion.id === v.id 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-white border-slate-100 hover:border-slate-300'
                         }`}
                       >
                         <div className="flex justify-between items-start mb-1">
                           <span className={`font-bold text-sm ${activeVersion.id === v.id ? 'text-blue-700' : 'text-slate-700'}`}>v{v.versionNumber}</span>
                           <span className="text-xs text-slate-400">{v.updatedAt.split(' ')[0]}</span>
                         </div>
                         <div className="text-xs text-slate-500 mb-2 truncate" title={v.fileName}>
                           {v.fileName}
                         </div>
                         <div className="flex gap-2">
                            {idx !== 0 || previewVersionId ? (
                                <button 
                                  onClick={() => setPreviewVersionId(v.id === selectedDoc.versions[0].id ? null : v.id)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                >
                                  <Eye size={12} /> {activeVersion.id === v.id ? '当前' : '预览'}
                                </button>
                            ) : (
                                <span className="flex-1 py-1 text-center text-xs text-green-600 bg-green-50 rounded border border-green-100 font-medium">最新版本</span>
                            )}
                         </div>
                       </div>
                     ))}
                  </div>
                </div>
             </div>
           </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
             <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <FileText size={40} className="opacity-50" />
             </div>
             <p className="text-lg font-medium text-slate-500">选择左侧文档查看详情</p>
             <p className="text-sm mt-2">支持按照大类、小类筛选与版本管理</p>
          </div>
        )}
      </div>

      {/* Category Manager Modal */}
      {isCatManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden h-[600px] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       <Settings size={20} /> 
                       分类管理
                   </h3>
                   <button onClick={() => setIsCatManagerOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="flex-1 flex overflow-hidden">
                    {/* Big Classes */}
                    <div className="w-1/2 border-r border-slate-200 flex flex-col">
                        <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-bold text-xs text-slate-500 uppercase tracking-wide">
                            大类 (Big Class)
                        </div>
                        <div className="p-2 border-b border-slate-100 flex gap-2">
                            <input 
                                className={INLINE_INPUT_STYLE} 
                                placeholder="New Category Name"
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                            />
                            <button onClick={handleAddCategory} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700">
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {Object.keys(categoryMap).map(cat => (
                                <div 
                                    key={cat}
                                    onClick={() => setSelectedCatForEdit(cat)}
                                    className={`flex justify-between items-center p-2 rounded cursor-pointer ${
                                        selectedCatForEdit === cat ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                >
                                    {editingCat === cat ? (
                                        <div className="flex items-center gap-1 w-full mr-2">
                                            <input 
                                                className={INLINE_INPUT_STYLE}
                                                value={editCatValue}
                                                onChange={e => setEditCatValue(e.target.value)}
                                                autoFocus
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRenameCategory(cat); }}
                                                className="text-green-600 hover:bg-green-100 rounded p-0.5"
                                            >
                                                <Check size={14}/>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingCat(null); }}
                                                className="text-slate-400 hover:bg-slate-200 rounded p-0.5"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-medium truncate flex-1">{cat}</span>
                                            <div className="flex gap-1 opacity-60 hover:opacity-100">
                                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingCat(cat); setEditCatValue(cat); }} className="text-slate-400 hover:text-blue-500 p-1">
                                                    <Edit size={14} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteCategory(cat); }} className="text-slate-400 hover:text-red-500 p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Small Classes */}
                    <div className="w-1/2 flex flex-col bg-slate-50/30">
                        <div className="p-3 border-b border-slate-100 bg-slate-50/50 font-bold text-xs text-slate-500 uppercase tracking-wide">
                            小类 (Sub Class)
                        </div>
                        {selectedCatForEdit ? (
                            <>
                                <div className="p-2 border-b border-slate-100 flex gap-2">
                                    <input 
                                        className={INLINE_INPUT_STYLE} 
                                        placeholder={`Add to ${selectedCatForEdit}`}
                                        value={newSubCatName}
                                        onChange={e => setNewSubCatName(e.target.value)}
                                    />
                                    <button onClick={handleAddSubCategory} className="bg-green-600 text-white px-3 rounded hover:bg-green-700">
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {categoryMap[selectedCatForEdit]?.map(sub => (
                                        <div key={sub} className="flex justify-between items-center p-2 rounded bg-white border border-slate-100 shadow-sm">
                                            {editingSubCat === sub ? (
                                                <div className="flex items-center gap-1 w-full">
                                                    <input 
                                                        className={INLINE_INPUT_STYLE}
                                                        value={editSubCatValue}
                                                        onChange={e => setEditSubCatValue(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={() => handleRenameSubCategory(selectedCatForEdit, sub)}
                                                        className="text-green-600 hover:bg-green-100 rounded p-0.5"
                                                    >
                                                        <Check size={14}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingSubCat(null)}
                                                        className="text-slate-400 hover:bg-slate-200 rounded p-0.5"
                                                    >
                                                        <X size={14}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="truncate flex-1">{sub}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingSubCat(sub); setEditSubCatValue(sub); }} className="text-slate-300 hover:text-blue-500 p-1">
                                                            <Edit size={14} />
                                                        </button>
                                                        <button onClick={() => handleDeleteSubCategory(selectedCatForEdit, sub)} className="text-slate-300 hover:text-red-500 p-1">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    {categoryMap[selectedCatForEdit]?.length === 0 && (
                                        <div className="text-center text-slate-400 italic text-sm mt-4">No sub-categories</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
                                Select a category to manage sub-items
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Upload/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === 'create' ? '上传新文档' : '更新文档'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
               {/* Update Mode Options */}
               {modalMode === 'update' && (
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="updateType"
                        checked={formData.updateType === 'new'}
                        onChange={() => setFormData({...formData, updateType: 'new'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-blue-900">发布新版本 (v{formData.versionNumber})</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="updateType"
                        checked={formData.updateType === 'overwrite'}
                        onChange={() => setFormData({...formData, updateType: 'overwrite'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-blue-900">覆盖当前版本</span>
                    </label>
                 </div>
               )}

               {/* Meta Fields */}
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className={LABEL_STYLE}>大类 (Category)</label>
                   <select
                      className={INPUT_STYLE} 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value, subCategory: ''})}
                   >
                       <option value="">Select Category</option>
                       {Object.keys(categoryMap).map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className={LABEL_STYLE}>小类 (Sub-Category)</label>
                   <select 
                      className={INPUT_STYLE} 
                      value={formData.subCategory} 
                      onChange={e => setFormData({...formData, subCategory: e.target.value})}
                      disabled={!formData.category}
                   >
                        <option value="">Select Sub-Category</option>
                        {formData.category && categoryMap[formData.category]?.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
               </div>

               <div>
                 <label className={LABEL_STYLE}>文档标题</label>
                 <input 
                    className={INPUT_STYLE}
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="请输入文档标题"
                 />
               </div>

               {modalMode === 'update' && formData.updateType === 'new' && (
                 <div>
                   <label className={LABEL_STYLE}>新版本号</label>
                   <input 
                      className={INPUT_STYLE}
                      value={formData.versionNumber} 
                      onChange={e => setFormData({...formData, versionNumber: e.target.value})}
                      placeholder="e.g. 1.1"
                   />
                 </div>
               )}

               <div>
                 <label className={LABEL_STYLE}>文档描述</label>
                 <textarea 
                    className={INPUT_STYLE}
                    rows={2}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="简要描述文档内容..."
                 />
               </div>

               {/* File Upload */}
               <div>
                  <label className={LABEL_STYLE}>
                    {modalMode === 'update' && formData.updateType === 'overwrite' ? '替换文件 (可选)' : '上传文件'}
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Upload size={24} />
                      <span className="text-sm font-medium">
                        {file ? file.name : '点击或拖拽文件到此处'}
                      </span>
                      {file && <span className="text-xs text-blue-600">{(file.size/1024).toFixed(1)} KB</span>}
                    </div>
                  </div>
               </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-colors"
              >
                {modalMode === 'create' ? '立即上传' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};