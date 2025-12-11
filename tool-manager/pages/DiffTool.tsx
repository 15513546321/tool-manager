import React, { useState, useRef } from 'react';
import { Split, FileCode, Play, Trash2, Folder, File, ChevronRight, ChevronDown, Filter, FileBox, FolderOpen, ArrowRightLeft } from 'lucide-react';
// @ts-ignore
import * as Diff from 'diff';
import JSZip from 'jszip';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  side?: 'left' | 'right' | 'both';
  status?: 'same' | 'diff' | 'missing' | 'added';
}

const CODE_STYLE = "w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-300 resize-none outline-none border-none leading-relaxed";

export const DiffTool: React.FC = () => {
  const [leftTree, setLeftTree] = useState<FileNode[]>([]);
  const [rightTree, setRightTree] = useState<FileNode[]>([]);
  const [mergedTree, setMergedTree] = useState<FileNode[]>([]);
  
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [diffResult, setDiffResult] = useState<any[] | null>(null);
  
  const [filterText, setFilterText] = useState('');

  // --- Decompile / Mock Logic ---
  const mockDecompile = (content: string, filename: string) => {
    // If it's a binary-like string or explicitly .class
    if (filename.endsWith('.class')) {
        return `// Decompiled ${filename}\npackage com.example.demo;\n\npublic class ${filename.replace('.class','')} {\n    // Decompilation simulated for browser demo\n    public void test() {\n        System.out.println("Binary content processed.");\n    }\n}`;
    }
    return content;
  };

  // --- File Parsing Helpers ---
  const parseFiles = async (files: FileList): Promise<FileNode[]> => {
    const nodes: FileNode[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.name.endsWith('.zip') || file.name.endsWith('.jar')) {
             const zip = await JSZip.loadAsync(file);
             const zipNodes: FileNode[] = [];
             
             // Convert Zip to flat list then tree
             // Simplified: just flat list for demo or simple hierarchy
             const entries: any[] = [];
             zip.forEach((path, entry) => entries.push({ path, entry }));
             
             for (const { path, entry } of entries) {
                if (!entry.dir) {
                    const content = await entry.async("string");
                    zipNodes.push({ name: path, path: path, type: 'file', content });
                }
             }
             nodes.push({ name: file.name, path: file.name, type: 'folder', children: zipNodes });
        } else {
             // Regular file
             const text = await file.text();
             nodes.push({ name: file.name, path: file.webkitRelativePath || file.name, type: 'file', content: text });
        }
    }
    return nodes;
  };

  const handleDrop = async (e: React.DragEvent, side: 'left' | 'right') => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
          const nodes = await parseFiles(files);
          if (side === 'left') setLeftTree(nodes);
          else setRightTree(nodes);
      }
  };

  // --- Comparison Logic ---
  const compareTrees = () => {
     // Flatten trees for matching (simplified for demo)
     const flatten = (nodes: FileNode[], prefix = ''): Record<string, FileNode> => {
         let map: Record<string, FileNode> = {};
         nodes.forEach(n => {
             const key = n.path || n.name; // Use relative path if available
             if (n.type === 'file') map[key] = n;
             if (n.children) Object.assign(map, flatten(n.children, key + '/'));
         });
         return map;
     };

     const leftMap = flatten(leftTree);
     const rightMap = flatten(rightTree);
     const allKeys = Array.from(new Set([...Object.keys(leftMap), ...Object.keys(rightMap)]));
     
     const merged: FileNode[] = allKeys.map(key => {
         const l = leftMap[key];
         const r = rightMap[key];
         
         let status: FileNode['status'] = 'same';
         if (!l) status = 'added'; // Right only
         else if (!r) status = 'missing'; // Left only
         else {
             // Compare content
             const lTxt = mockDecompile(l.content || '', l.name);
             const rTxt = mockDecompile(r.content || '', r.name);
             // Basic strict equality check, ignoring CR
             if (lTxt.replace(/\r/g,'') !== rTxt.replace(/\r/g,'')) status = 'diff';
         }

         return {
             name: key,
             path: key,
             type: 'file',
             status,
             content: '', // Not needed in tree
             // Store originals for click
             side: l && r ? 'both' : (l ? 'left' : 'right'),
             _left: l,
             _right: r
         } as any;
     });

     setMergedTree(merged.sort((a,b) => a.name.localeCompare(b.name)));
     setDiffResult(null); // Clear previous diff
  };

  const selectFile = (node: any) => {
      setSelectedFile(node);
      const l = node._left ? mockDecompile(node._left.content || '', node._left.name) : '';
      const r = node._right ? mockDecompile(node._right.content || '', node._right.name) : '';
      setLeftContent(l);
      setRightContent(r);
      
      if (l && r) {
        const diff = Diff.diffLines(l, r);
        setDiffResult(diff);
      } else {
        setDiffResult(null);
      }
  };

  const filteredTree = mergedTree.filter(n => n.name.toLowerCase().includes(filterText.toLowerCase()));

  return (
    <div className="h-full flex flex-col p-4 bg-slate-50 overflow-hidden">
       {/* Top Bar */}
       <div className="mb-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <Split className="text-blue-600"/> 代码比对工具 (Beyond Compare 风格)
            </h2>
            <p className="text-slate-500 text-xs mt-1">支持 .java, .xml, .class (模拟反编译) 及 压缩包比对</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => { setLeftTree([]); setRightTree([]); setMergedTree([]); setSelectedFile(null); }} className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-red-500 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                <Trash2 size={14}/> 重置
             </button>
             <button onClick={compareTrees} className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md shadow-blue-500/20 font-bold transition-colors">
                <Play size={16}/> 开始比对
             </button>
          </div>
       </div>

       {/* Main Workspace */}
       <div className="flex-1 flex gap-4 overflow-hidden">
           {/* Sidebar: File Tree */}
           <div className="w-80 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               {/* Drop Zones Setup */}
               {mergedTree.length === 0 ? (
                   <div className="flex-1 flex flex-col gap-4 p-4">
                       <div 
                         onDragOver={e => e.preventDefault()}
                         onDrop={e => handleDrop(e, 'left')}
                         className="flex-1 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50 flex flex-col items-center justify-center text-center p-4 transition-colors hover:bg-blue-100 hover:border-blue-400"
                       >
                           <FolderOpen className="text-blue-400 mb-2" size={32}/>
                           <div className="font-bold text-blue-800">左侧代码包</div>
                           <div className="text-xs text-blue-600 mt-1">拖入 Zip, Jar 或文件夹</div>
                           <div className="mt-2 text-xs text-slate-400">{leftTree.length > 0 ? `${leftTree.length} files loaded` : 'No files'}</div>
                       </div>
                       
                       <div className="flex justify-center"><ArrowRightLeft size={20} className="text-slate-300"/></div>

                       <div 
                         onDragOver={e => e.preventDefault()}
                         onDrop={e => handleDrop(e, 'right')}
                         className="flex-1 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50 flex flex-col items-center justify-center text-center p-4 transition-colors hover:bg-purple-100 hover:border-purple-400"
                       >
                           <FolderOpen className="text-purple-400 mb-2" size={32}/>
                           <div className="font-bold text-purple-800">右侧代码包</div>
                           <div className="text-xs text-purple-600 mt-1">拖入 Zip, Jar 或文件夹</div>
                           <div className="mt-2 text-xs text-slate-400">{rightTree.length > 0 ? `${rightTree.length} files loaded` : 'No files'}</div>
                       </div>
                   </div>
               ) : (
                   <div className="flex-1 flex flex-col">
                       <div className="p-3 border-b border-slate-100 flex gap-2">
                           <div className="relative flex-1">
                               <Filter className="absolute left-2 top-2 text-slate-400" size={12}/>
                               <input 
                                 className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:border-blue-300"
                                 placeholder="Filter files..."
                                 value={filterText}
                                 onChange={e => setFilterText(e.target.value)}
                               />
                           </div>
                       </div>
                       <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                           {filteredTree.map((node, idx) => (
                               <div 
                                 key={idx}
                                 onClick={() => selectFile(node)}
                                 className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs font-mono transition-colors ${selectedFile?.name === node.name ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-50'}`}
                               >
                                   {/* Status Icon */}
                                   {node.status === 'same' && <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0"/>}
                                   {node.status === 'diff' && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"/>}
                                   {node.status === 'missing' && <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0"/>}
                                   {node.status === 'added' && <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"/>}
                                   
                                   <File size={12} className="text-slate-400 shrink-0"/>
                                   <span className={`truncate ${node.status === 'diff' ? 'text-red-700 font-bold' : 'text-slate-700'}`}>{node.name}</span>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
           </div>

           {/* Diff View Area */}
           <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               {selectedFile ? (
                   <div className="flex-1 flex flex-col">
                       <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between items-center text-xs font-mono text-slate-600">
                           <div className="flex items-center gap-2 w-1/2 overflow-hidden px-2 border-r border-slate-200">
                               <FileCode size={14} className="text-blue-500"/>
                               <span className="truncate">{selectedFile.name} (Left)</span>
                           </div>
                           <div className="flex items-center gap-2 w-1/2 overflow-hidden px-2">
                               <FileCode size={14} className="text-purple-500"/>
                               <span className="truncate">{selectedFile.name} (Right)</span>
                           </div>
                       </div>
                       
                       <div className="flex-1 overflow-auto bg-white relative font-mono text-xs leading-5">
                          {diffResult ? (
                              <div className="flex flex-col w-full min-h-full">
                                  {diffResult.map((part: any, index: number) => {
                                      // Render simplified unified-like diff, but trying to look side-by-side conceptually
                                      // For true side-by-side, we usually render two columns. Here we use a linear color coded view.
                                      const bgClass = part.added ? 'bg-green-50 border-l-4 border-green-400' :
                                                      part.removed ? 'bg-red-50 border-l-4 border-red-400' : 
                                                      'hover:bg-slate-50 border-l-4 border-transparent';
                                      const textClass = part.added ? 'text-green-900' : part.removed ? 'text-red-900' : 'text-slate-600';
                                      
                                      return (
                                          <div key={index} className={`${bgClass} px-2 whitespace-pre-wrap py-0.5 w-full`}>
                                              <span className="select-none inline-block w-6 text-slate-300 text-[10px] text-right mr-2">{part.added ? '+' : part.removed ? '-' : ''}</span>
                                              <span className={textClass}>{part.value}</span>
                                          </div>
                                      );
                                  })}
                              </div>
                          ) : (
                             <div className="flex h-full">
                                <textarea readOnly className="flex-1 resize-none p-4 bg-slate-50 outline-none text-slate-500 border-r border-slate-200" value={leftContent || '(Empty or Missing)'}/>
                                <textarea readOnly className="flex-1 resize-none p-4 bg-white outline-none text-slate-800" value={rightContent || '(Empty or Missing)'}/>
                             </div>
                          )}
                       </div>
                   </div>
               ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                       <Split size={48} className="mb-4 opacity-50"/>
                       <p className="text-lg font-medium">Select a file to compare</p>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};