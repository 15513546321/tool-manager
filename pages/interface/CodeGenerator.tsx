import React, { useState, useEffect, useRef } from 'react';
import { Copy, Code, ArrowRightLeft, Database, Plus, Trash2, Save, FileDown, Upload, FileCode, ChevronRight, ChevronDown, FolderPlus, Layers } from 'lucide-react';
import { generateXml, generateJava } from '../../services/xmlParser';
import { XmlTransaction, XmlField } from '../../types';
import { recordAction } from '../../services/auditService';
import { Database as DB, TABLE } from '../../services/database';

// Eye-friendly input style (soft background)
const INPUT_STYLE = "w-full p-2 border border-slate-200 rounded mt-1 bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const LABEL_STYLE = "text-xs font-bold text-slate-500 uppercase tracking-wide";

// --- Recursive Field Editor Component ---
interface FieldTreeItemProps {
  field: XmlField;
  path: number[]; // path of indices
  onUpdate: (path: number[], updated: XmlField) => void;
  onRemove: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
}

const FieldTreeItem: React.FC<FieldTreeItemProps> = ({ field, path, onUpdate, onRemove, onAddChild }) => {
  const [expanded, setExpanded] = useState(true);
  const isContainer = field.type === 'array' || field.type === 'object';

  return (
    <div className="pl-4 border-l border-slate-200 ml-1">
      <div className="flex items-center gap-2 py-2 group">
        {isContainer && (
            <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600">
                {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </button>
        )}
        {!isContainer && <div className="w-[14px]"></div>}

        <select 
            value={field.type}
            onChange={(e) => onUpdate(path, { ...field, type: e.target.value })}
            className="w-20 bg-transparent text-xs font-bold text-blue-600 border-none outline-none cursor-pointer hover:bg-slate-100 rounded focus:ring-0"
        >
            <option value="field">Field</option>
            <option value="string">String</option>
            <option value="date">Date</option>
            <option value="array">Array</option>
            <option value="object">Object</option>
        </select>

        <input 
            className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none text-sm px-1 text-slate-700 font-mono"
            placeholder={field.type === 'object' ? '<obj>' : 'name'}
            value={field.name}
            onChange={(e) => onUpdate(path, { ...field, name: e.target.value })}
        />
        
        <input 
            className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none text-sm px-1 text-slate-500"
            placeholder="Description"
            value={field.description}
            onChange={(e) => onUpdate(path, { ...field, description: e.target.value })}
        />

        {!isContainer && (
             <input 
             className="w-24 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 outline-none text-xs px-1 text-slate-400 text-right font-mono"
             placeholder={field.type === 'date' ? 'pattern' : 'style'}
             value={field.type === 'date' ? (field.pattern || '') : (field.style || '')}
             onChange={(e) => onUpdate(path, { ...field, [field.type === 'date' ? 'pattern' : 'style']: e.target.value })}
           />
        )}

        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            {isContainer && (
                <button onClick={() => onAddChild(path)} className="p-1 text-green-500 hover:bg-green-50 rounded" title="Add Child">
                    <Plus size={14}/>
                </button>
            )}
            <button onClick={() => onRemove(path)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Remove">
                <Trash2 size={14}/>
            </button>
        </div>
      </div>

      {isContainer && expanded && field.children && (
          <div className="ml-2">
              {field.children.map((child, idx) => (
                  <FieldTreeItem 
                    key={idx} 
                    field={child} 
                    path={[...path, idx]} 
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onAddChild={onAddChild}
                  />
              ))}
              {field.children.length === 0 && (
                  <div className="pl-8 py-1 text-xs text-slate-300 italic">Empty container. Add fields or objects.</div>
              )}
          </div>
      )}
    </div>
  );
};

export const CodeGenerator: React.FC = () => {
  // --- State: Batch Management ---
  const [transactions, setTransactions] = useState<XmlTransaction[]>([{
    id: 'newTransaction',
    template: 'ExecuteLogTemplate',
    trsName: '',
    actionRef: '',
    inputs: [],
    outputs: [],
    module: 'Manual',
    filePath: '',
    actionClass: '',
    downstreamCalls: []
  }]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Shortcut to current form data
  const formData = transactions[currentIndex];
  
  const setFormData = (newData: XmlTransaction | ((prev: XmlTransaction) => XmlTransaction)) => {
      setTransactions(prev => {
          const list = [...prev];
          if (typeof newData === 'function') {
            list[currentIndex] = newData(list[currentIndex]);
          } else {
            list[currentIndex] = newData;
          }
          return list;
      });
  };

  const [metaData, setMetaData] = useState({
    author: 'pmb',
    version: '1.0'
  });

  // --- Template Management State ---
  const [templates, setTemplates] = useState<string[]>(['ExecuteLogTemplate', 'PublicExecuteTemplate', 'queryTemplate']);
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // --- View State ---
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  const [outputTab, setOutputTab] = useState<'xml' | 'java'>('xml');
  const [generatedXml, setGeneratedXml] = useState('');
  const [generatedJava, setGeneratedJava] = useState('');
  const [isBatchView, setIsBatchView] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = DB.findAll<string>(TABLE.TEMPLATES);
    if (saved.length > 0) setTemplates(saved);
  }, []);

  const saveTemplates = (newTemplates: string[]) => {
    setTemplates(newTemplates);
    DB.save(TABLE.TEMPLATES, newTemplates);
  };

  const handleTemplateAdd = () => {
    if (newTemplateName && !templates.includes(newTemplateName)) {
        const updated = [...templates, newTemplateName];
        saveTemplates(updated);
        setFormData((prev: XmlTransaction) => ({...prev, template: newTemplateName}));
        setNewTemplateName('');
        setIsTemplateEditable(false);
    }
  };

  const handleTemplateDelete = () => {
      const updated = templates.filter(t => t !== formData.template);
      saveTemplates(updated);
      setFormData((prev: XmlTransaction) => ({...prev, template: updated[0] || ''}));
  };

  // --- Field Management ---
  const updateField = (rootList: XmlField[], path: number[], updated: XmlField): XmlField[] => {
     if (path.length === 0) return rootList;
     const [currentIdx, ...rest] = path;
     const newList = [...rootList];
     
     if (rest.length === 0) {
         newList[currentIdx] = updated;
     } else {
         newList[currentIdx] = {
             ...newList[currentIdx],
             children: updateField(newList[currentIdx].children || [], rest, updated)
         };
     }
     return newList;
  };

  const removeField = (rootList: XmlField[], path: number[]): XmlField[] => {
    const [currentIdx, ...rest] = path;
    const newList = [...rootList];
    
    if (rest.length === 0) {
        newList.splice(currentIdx, 1);
    } else {
        newList[currentIdx] = {
            ...newList[currentIdx],
            children: removeField(newList[currentIdx].children || [], rest)
        };
    }
    return newList;
  };

  const addChildField = (rootList: XmlField[], path: number[]): XmlField[] => {
      const [currentIdx, ...rest] = path;
      const newList = [...rootList];
      
      if (rest.length === 0) {
          const children = newList[currentIdx].children || [];
          newList[currentIdx] = {
              ...newList[currentIdx],
              children: [...children, { name: '', type: 'field', description: '', style: 'CommonStyle' }]
          };
      } else {
          newList[currentIdx] = {
              ...newList[currentIdx],
              children: addChildField(newList[currentIdx].children || [], rest)
          };
      }
      return newList;
  };

  const handleFieldUpdate = (path: number[], updated: XmlField) => {
      if (activeTab === 'request') {
          setFormData((prev: XmlTransaction) => ({ ...prev, inputs: updateField(prev.inputs, path, updated) }));
      } else {
          setFormData((prev: XmlTransaction) => ({ ...prev, outputs: updateField(prev.outputs, path, updated) }));
      }
  };

  const handleFieldRemove = (path: number[]) => {
      if (activeTab === 'request') {
          setFormData((prev: XmlTransaction) => ({ ...prev, inputs: removeField(prev.inputs, path) }));
      } else {
          setFormData((prev: XmlTransaction) => ({ ...prev, outputs: removeField(prev.outputs, path) }));
      }
  };

  const handleAddChild = (path: number[]) => {
      if (activeTab === 'request') {
          setFormData((prev: XmlTransaction) => ({ ...prev, inputs: addChildField(prev.inputs, path) }));
      } else {
          setFormData((prev: XmlTransaction) => ({ ...prev, outputs: addChildField(prev.outputs, path) }));
      }
  };

  const handleAddRootField = () => {
      const newField: XmlField = { name: '', type: 'field', description: '', style: 'CommonStyle' };
      if (activeTab === 'request') {
          setFormData((prev: XmlTransaction) => ({ ...prev, inputs: [...prev.inputs, newField] }));
      } else {
          setFormData((prev: XmlTransaction) => ({ ...prev, outputs: [...prev.outputs, newField] }));
      }
  };

  // --- Generation Logic ---
  const handleGenerate = () => {
    setIsBatchView(false);
    const dataToProcess = {
      ...formData,
      actionRef: formData.actionRef || (formData.id ? `${formData.id}Action` : '')
    };
    
    setGeneratedXml(generateXml(dataToProcess));
    setGeneratedJava(generateJava(dataToProcess, metaData.author));
    
    recordAction('接口管理 - 代码生成', `按钮:生成代码 - 生成单接口 [${formData.id}]`);
  };

  const handleGenerateAll = () => {
      setIsBatchView(true);
      
      let allXml = '';
      let allJava = '';

      transactions.forEach(tr => {
          const dataToProcess = {
              ...tr,
              actionRef: tr.actionRef || (tr.id ? `${tr.id}Action` : '')
          };
          allXml += `<!-- Transaction: ${tr.id} -->\n${generateXml(dataToProcess)}\n\n`;
          allJava += `// --- ${tr.id}Action.java ---\n${generateJava(dataToProcess, metaData.author)}\n\n`;
      });

      setGeneratedXml(allXml);
      setGeneratedJava(allJava);
      
      recordAction('接口管理 - 代码生成', `按钮:批量生成 - 生成所有接口 (${transactions.length}个)`);
  };

  const copyToClipboard = () => {
    const text = outputTab === 'xml' ? generatedXml : generatedJava;
    navigator.clipboard.writeText(text);
  };

  // --- Excel Template & Import Logic ---
  const handleDownloadExcelTemplate = () => {
      recordAction('接口管理 - 代码生成', '按钮:下载模板 - 下载接口定义Excel模板');
      const exampleJsonInput = JSON.stringify([{ name: "pageNo", type: "field", description: "Page Number", style: "IntegerStyle" }]);
      const exampleJsonOutput = JSON.stringify([{ name: "result", type: "object", description: "Result Object", children: [{name:"id", type:"field"}]}]);
      
      const xmlBody = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellBorder">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Template">
  <Table ss:ExpandedColumnCount="6" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="300"/>
   <Column ss:Width="300"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Template</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Action Ref</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Inputs (JSON)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Outputs (JSON)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">exampleQuery</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">ExecuteLogTemplate</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Example Query</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">exampleQueryAction</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${exampleJsonInput.replace(/"/g, '&quot;')}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${exampleJsonOutput.replace(/"/g, '&quot;')}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

      const blob = new Blob([xmlBody], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Interface_Gen_Template.xls';
      a.click();
  };

  const handleUploadBatch = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const content = event.target?.result as string;
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(content, "text/xml");
                  
                  // Check validity
                  if (doc.getElementsByTagName("parsererror").length > 0) {
                      throw new Error("Invalid XML file.");
                  }

                  const rows = Array.from(doc.getElementsByTagName("Row"));
                  
                  const newTransactions: XmlTransaction[] = [];
                  let errorCount = 0;
                  
                  // Skip header (Row 1), start from 1 (0-indexed array, but Row 1 is header)
                  // Note: XML Spreadsheet 'Row' elements might be sparse if blank lines exist.
                  // We scan all rows and check for content.
                  for (let i = 0; i < rows.length; i++) {
                      try {
                          const cells = Array.from(rows[i].getElementsByTagName("Cell"));
                          // Rudimentary check for header row (look for "Transaction ID")
                          const firstCellText = cells[0]?.textContent || "";
                          if (firstCellText === "Transaction ID") continue;

                          // Extract text content from cells (simplified, assumes sequential order)
                          const dataValues: string[] = [];
                          cells.forEach(cell => {
                              const dataTags = cell.getElementsByTagName("Data");
                              if (dataTags.length > 0) {
                                  dataValues.push(dataTags[0].textContent || "");
                              } else {
                                  dataValues.push("");
                              }
                          });

                          // We expect at least an ID
                          if (dataValues.length > 0 && dataValues[0]) {
                              newTransactions.push({
                                  id: dataValues[0],
                                  template: dataValues[1] || "ExecuteLogTemplate",
                                  trsName: dataValues[2] || "",
                                  actionRef: dataValues[3] || "",
                                  inputs: dataValues[4] ? JSON.parse(dataValues[4]) : [],
                                  outputs: dataValues[5] ? JSON.parse(dataValues[5]) : [],
                                  module: "Imported",
                                  filePath: "",
                                  actionClass: "",
                                  downstreamCalls: []
                              });
                          }
                      } catch (rowErr) {
                          console.warn("Skipping faulty row index", i, rowErr);
                          errorCount++;
                      }
                  }

                  if (newTransactions.length > 0) {
                      setTransactions(newTransactions);
                      setCurrentIndex(0);
                      recordAction('接口管理 - 代码生成', `按钮:批量上传 - 成功解析 ${newTransactions.length} 条记录`);
                      alert(`Successfully loaded ${newTransactions.length} interfaces.${errorCount > 0 ? ` (Skipped ${errorCount} invalid rows)` : ''}`);
                  } else {
                      alert("No valid data found in template.");
                  }

              } catch (err) {
                  console.error(err);
                  alert("Failed to parse Excel XML. Ensure format is correct.");
              }
          };
          reader.readAsText(file);
      }
  };

  return (
    <div className="p-6 h-full flex flex-col md:flex-row gap-6 bg-slate-50">
      {/* Form Side */}
      <div className="w-full md:w-3/5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <Code size={24} className="text-blue-600"/>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Interface Designer</h2>
                    {transactions.length > 1 && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">Editing:</span>
                            <select 
                                className="text-xs border border-slate-200 rounded px-1 py-0.5 outline-none bg-slate-50 font-bold text-blue-600"
                                value={currentIndex}
                                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                            >
                                {transactions.map((t, i) => (
                                    <option key={i} value={i}>{t.id || `Item ${i+1}`}</option>
                                ))}
                            </select>
                            <span className="text-xs text-slate-400">({currentIndex + 1}/{transactions.length})</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={handleDownloadExcelTemplate} className="text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-full hover:bg-slate-100 flex items-center gap-2 text-xs font-bold border border-transparent hover:border-slate-200 transition-all" title="Download Excel Template">
                    <FileDown size={16} /> 下载模板
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-full hover:bg-slate-100 flex items-center gap-2 text-xs font-bold border border-transparent hover:border-slate-200 transition-all" title="Upload Excel Config">
                    <Upload size={16} /> 批量上传
                </button>
                <input ref={fileInputRef} type="file" className="hidden" accept=".xml,.xls" onChange={handleUploadBatch} />
                
                <button 
                  onClick={() => {
                      setTransactions(prev => [...prev, {
                        id: '',
                        template: 'ExecuteLogTemplate',
                        trsName: '',
                        actionRef: '',
                        inputs: [],
                        outputs: [],
                        module: 'Manual',
                        filePath: '',
                        actionClass: '',
                        downstreamCalls: []
                      }]);
                      setCurrentIndex(transactions.length);
                      recordAction('接口管理 - 代码生成', '按钮:新增 - 添加新接口配置');
                  }}
                  className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                  title="Add New Interface"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>

        <div className="space-y-5 flex-1">
          {/* Top Config */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={LABEL_STYLE}>Transaction ID</label>
              <input 
                type="text"
                value={formData.id}
                onChange={e => setFormData(prev => ({...prev, id: e.target.value}))}
                className={INPUT_STYLE}
                placeholder="e.g. entCertInfoQry"
              />
            </div>
            <div>
              <label className={LABEL_STYLE}>Template</label>
              <div className="flex gap-2 mt-1">
                  {!isTemplateEditable ? (
                      <div className="relative w-full">
                          <select 
                            value={formData.template}
                            onChange={e => setFormData(prev => ({...prev, template: e.target.value}))}
                            className={`${INPUT_STYLE} mt-0 appearance-none`}
                          >
                            {templates.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <div className="absolute right-0 top-0 h-full flex items-center pr-2 gap-1">
                             <button onClick={() => setIsTemplateEditable(true)} className="p-1 text-slate-400 hover:text-blue-500"><Plus size={14}/></button>
                             <button onClick={handleTemplateDelete} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex w-full gap-2">
                          <input 
                            className={`${INPUT_STYLE} mt-0`} 
                            autoFocus 
                            placeholder="New Template Name"
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                          />
                          <button onClick={handleTemplateAdd} className="bg-blue-600 text-white px-3 rounded text-xs font-bold">Add</button>
                          <button onClick={() => setIsTemplateEditable(false)} className="text-slate-400 hover:text-slate-600"><Code size={16}/></button>
                      </div>
                  )}
              </div>
            </div>
          </div>

          <div>
             <label className={LABEL_STYLE}>Description</label>
             <input 
                type="text"
                value={formData.trsName}
                onChange={e => setFormData(prev => ({...prev, trsName: e.target.value}))}
                className={INPUT_STYLE}
                placeholder="e.g. Enterprise Certificate Query"
              />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={LABEL_STYLE}>Author</label>
              <input 
                type="text"
                value={metaData.author}
                onChange={e => setMetaData({...metaData, author: e.target.value})}
                className={INPUT_STYLE}
              />
            </div>
            <div>
               <label className={LABEL_STYLE}>Action Ref (Bean)</label>
              <input 
                type="text"
                value={formData.actionRef}
                onChange={e => setFormData(prev => ({...prev, actionRef: e.target.value}))}
                className={INPUT_STYLE}
                placeholder="Auto-generated if empty"
              />
            </div>
          </div>

          {/* Fields Editor */}
          <div className="border-t border-slate-100 pt-4 flex flex-col h-[400px]">
            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => setActiveTab('request')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeTab === 'request' 
                    ? 'bg-blue-100 text-blue-700 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ArrowRightLeft size={16} />
                Request
              </button>
              <button 
                onClick={() => setActiveTab('response')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeTab === 'response' 
                    ? 'bg-purple-100 text-purple-700 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Database size={16} />
                Response
              </button>
            </div>

            {/* Tree Header */}
            <div className="flex px-4 py-2 bg-slate-50 border border-slate-100 rounded-t-lg text-xs font-bold text-slate-400 uppercase">
                <div className="w-24 pl-6">Type</div>
                <div className="flex-1 px-1">Name / Tag</div>
                <div className="flex-1 px-1">Description</div>
                <div className="w-24 text-right px-1">Style/Pattern</div>
                <div className="w-10"></div>
            </div>

            {/* Tree Content */}
            <div className="flex-1 border border-t-0 border-slate-100 rounded-b-lg overflow-y-auto bg-white p-2">
                {(activeTab === 'request' ? formData.inputs : formData.outputs).map((f, i) => (
                    <FieldTreeItem 
                        key={i} 
                        field={f} 
                        path={[i]} 
                        onUpdate={handleFieldUpdate} 
                        onRemove={handleFieldRemove}
                        onAddChild={handleAddChild}
                    />
                ))}
                
                <button 
                    onClick={handleAddRootField}
                    className="w-full py-2 mt-2 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded border border-dashed border-slate-200 transition-colors text-sm"
                >
                    <FolderPlus size={16} /> Add Root Field
                </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={handleGenerate}
                className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
              >
                <Code size={18} />
                Generate This
              </button>
              <button 
                onClick={handleGenerateAll}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                <Layers size={18} />
                Generate All
              </button>
          </div>
        </div>
      </div>

      {/* Code Side */}
      <div className="w-full md:w-2/5 flex flex-col gap-4">
        {/* Tab Switcher */}
        <div className="flex bg-slate-200 p-1 rounded-lg self-start">
             <button 
                onClick={() => setOutputTab('xml')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${outputTab === 'xml' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
             >
                XML Config
             </button>
             <button 
                onClick={() => setOutputTab('java')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${outputTab === 'java' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
             >
                Java Implementation
             </button>
        </div>

        <div className="flex-1 bg-[#1e293b] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700">
            <div className="bg-[#0f172a] p-3 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2">{outputTab === 'xml' ? (isBatchView ? 'batch-transactions.xml' : 'transaction.xml') : (isBatchView ? 'BatchActions.java' : `${formData.id || 'Transaction'}Action.java`)}</span>
                </div>
                <button onClick={copyToClipboard} className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10" title="Copy Code">
                    <Copy size={16}/>
                </button>
            </div>
            <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-blue-100 leading-relaxed scrollbar-thin scrollbar-thumb-slate-600">
                {outputTab === 'xml' ? (generatedXml || '<!-- Generated XML will appear here -->') : (generatedJava || '// Generated Java code will appear here')}
            </pre>
        </div>
      </div>
    </div>
  );
};