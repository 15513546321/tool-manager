import React, { useState, useMemo, useRef } from 'react';
import { Download, Folder, Eye, X, FileJson, ChevronDown, FileCode, Layers, ChevronLeft, ChevronRight, Activity, ArrowRightLeft, Info } from 'lucide-react';
import { parseProjectFiles, FileEntry } from '../../services/xmlParser';
import { XmlTransaction, XmlField } from '../../types';
import { recordAction } from '../../services/auditService';

// Helper to escape XML special characters
const escapeXml = (unsafe: string | undefined | null) => {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

// Recursive Field Renderer for Modal
const FieldTree: React.FC<{ fields: XmlField[]; depth?: number }> = ({ fields, depth = 0 }) => {
  if (!fields || fields.length === 0) return <div className="text-slate-400 italic text-xs py-1">None</div>;

  return (
    <div className="space-y-1">
      {fields.map((f, i) => (
        <div key={i}>
          <div 
            className="flex items-start text-sm py-1 border-b border-slate-50 hover:bg-slate-50 rounded px-1"
            style={{ paddingLeft: `${depth * 12}px` }}
          >
            <div className="flex-1 font-mono text-slate-700 flex gap-2">
               {f.children && f.children.length > 0 && <ChevronDown size={14} className="mt-1 text-slate-400"/>}
               <span className={f.children ? 'font-bold text-slate-800' : ''}>
                 {f.name || <span className="text-slate-400 italic">&lt;{f.type}&gt;</span>}
               </span>
               <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded self-start">{f.type}</span>
            </div>
            <div className="flex-1 text-slate-600">{f.description}</div>
            <div className="flex-1 text-slate-500 text-xs font-mono truncate" title={f.style}>
              {f.style || f.pattern || '-'}
            </div>
          </div>
          {f.children && (
            <FieldTree fields={f.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
};

export const DocManagement: React.FC = () => {
  const [transactions, setTransactions] = useState<XmlTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<XmlTransaction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Derived state for pagination
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  
  const currentTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return transactions.slice(start, start + itemsPerPage);
  }, [transactions, currentPage]);

  // Group transactions by Module
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, XmlTransaction[]> = {};
    currentTransactions.forEach(t => {
      if (!groups[t.module]) groups[t.module] = [];
      groups[t.module].push(t);
    });
    return groups;
  }, [currentTransactions]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsProcessing(true);
    const files: FileEntry[] = [];

    // Read all files first
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Accept XML, Java, Properties
      if (file.name.endsWith('.xml') || file.name.endsWith('.java') || file.name.endsWith('.properties')) {
        try {
            const text = await file.text();
            const path = file.webkitRelativePath || file.name;
            files.push({ name: file.name, path, content: text });
        } catch (err) {
            console.error(`Failed to read file ${file.name}`, err);
        }
      }
    }

    // Process using Project Parser
    try {
        const newTransactions = parseProjectFiles(files);
        setTransactions(prev => {
            setCurrentPage(1); 
            return newTransactions; 
        });
        // Log
        recordAction('接口管理 - 文档管理', `按钮:加载文件夹 - 已加载 ${newTransactions.length} 个接口文件`);
    } catch (err) {
        console.error("Failed to parse project files", err);
        alert("Parsing failed. Check console for details.");
    } finally {
        setIsProcessing(false);
    }
  };

  // Generate XML Spreadsheet 2003 format
  const handleExportExcel = () => {
    recordAction('接口管理 - 文档管理', '按钮:导出 Excel - 导出当前接口列表');
    let xmlBody = `<?xml version="1.0"?>
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
   <NumberFormat/>
   <Protection/>
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
  <Style ss:ID="SubHeader">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Hyperlink">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#0563C1" ss:Underline="Single"/>
  </Style>
  <Style ss:ID="CellBorder">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
   </Borders>
  </Style>
  <Style ss:ID="ErrorCell">
   <Interior ss:Color="#FFC7CE" ss:Pattern="Solid"/>
   <Font ss:Color="#9C0006"/>
  </Style>
 </Styles>`;

    // Store mappings of Transaction ID -> Unique Sheet Name
    const sheetNameMap: Record<string, string> = {};
    const usedSheetNames = new Set<string>();

    const getSafeSheetName = (id: string, nameHint: string) => {
        // Excel Sheet Limit: 31 chars, no []*:?/\
        let base = (id || nameHint || 'Untitled').replace(/[:\\/?*\[\]]/g, '').trim();
        if (base.length > 25) base = base.substring(0, 25);
        if (base.length === 0) base = 'Sheet';

        let unique = base;
        let counter = 1;
        while(usedSheetNames.has(unique.toLowerCase())) {
            unique = `${base}_${counter}`;
            counter++;
        }
        usedSheetNames.add(unique.toLowerCase());
        return unique;
    };

    // 2. Summary Sheet
    xmlBody += `
 <Worksheet ss:Name="Summary">
  <Table ss:ExpandedColumnCount="5" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="250"/>
   <Column ss:Width="100"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Module</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Path</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Link</Data></Cell>
   </Row>`;

    transactions.forEach(t => {
      try {
          const sheetName = getSafeSheetName(t.id, 'Trans');
          sheetNameMap[t.id] = sheetName;

          xmlBody += `
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.id)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.trsName)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.module)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.filePath)}</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:HRef="#'${sheetName}'!A1"><Data ss:Type="String">Go to Detail</Data></Cell>
       </Row>`;
      } catch (e) {
          console.error(`Error adding summary row for ${t.id}`, e);
          xmlBody += `<Row><Cell ss:StyleID="ErrorCell"><Data ss:Type="String">Error Exporting ${escapeXml(t.id)}</Data></Cell></Row>`;
      }
    });

    xmlBody += `
  </Table>
 </Worksheet>`;

    // --- 3. Code Generation Template Sheet (Sync with Code Generator) ---
    xmlBody += `
 <Worksheet ss:Name="Code_Gen_Template">
  <Table ss:ExpandedColumnCount="6" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="200"/>
   <Column ss:Width="150"/>
   <Column ss:Width="300"/>
   <Column ss:Width="300"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Transaction ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Template</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Action Ref</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Inputs (JSON)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Outputs (JSON)</Data></Cell>
   </Row>`;
    
    transactions.forEach(t => {
       try {
           const inputsJson = JSON.stringify(t.inputs).replace(/"/g, '&quot;');
           const outputsJson = JSON.stringify(t.outputs).replace(/"/g, '&quot;');
           xmlBody += `
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.id)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.trsName)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(t.actionRef)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(inputsJson)}</Data></Cell>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(outputsJson)}</Data></Cell>
       </Row>`;
       } catch (e) {
           console.error("Error exporting code gen template row", e);
       }
    });
    
    xmlBody += `
  </Table>
 </Worksheet>`;

    // 4. Individual Sheets
    const recursiveRowBuilder = (fields: XmlField[], depth: number): string => {
        let rows = '';
        fields.forEach(f => {
            const indent = ' '.repeat(depth * 4);
            const name = f.children ? `[+] ${f.name}` : f.name;
            const type = f.type === 'field' ? (f.style || 'String') : f.type;
            
            rows += `
   <Row>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${indent}${escapeXml(name)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.description)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(type)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${escapeXml(f.pattern || f.style)}</Data></Cell>
    <Cell ss:StyleID="CellBorder"><Data ss:Type="String">${f.children ? 'Complex' : 'Simple'}</Data></Cell>
   </Row>`;
            
            if (f.children && f.children.length > 0) {
                rows += recursiveRowBuilder(f.children, depth + 1);
            }
        });
        return rows;
    };

    transactions.forEach(t => {
      try {
          const safeSheetName = sheetNameMap[t.id];
          // Skip if no sheet name allocated (meaning failed summary)
          if (!safeSheetName) return;

          xmlBody += `
     <Worksheet ss:Name="${safeSheetName}">
      <Table ss:ExpandedColumnCount="5" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
       <Column ss:Width="200"/>
       <Column ss:Width="200"/>
       <Column ss:Width="100"/>
       <Column ss:Width="150"/>
       <Column ss:Width="80"/>
       
       <Row>
         <Cell ss:HRef="#'Summary'!A1" ss:StyleID="Hyperlink"><Data ss:Type="String">&lt;&lt; Back to Summary</Data></Cell>
       </Row>
       <Row ss:Height="20"/>
       
       <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="4"><Data ss:Type="String">${escapeXml(t.trsName)} (${escapeXml(t.id)})</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Module</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.module)}</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Action Class</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.actionClass)}</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="CellBorder"><Data ss:Type="String">Template</Data></Cell>
        <Cell ss:StyleID="CellBorder" ss:MergeAcross="3"><Data ss:Type="String">${escapeXml(t.template)}</Data></Cell>
       </Row>

       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Downstream Interface Calls</Data></Cell>
       </Row>
       ${t.downstreamCalls.length > 0 ? t.downstreamCalls.map(call => `
       <Row>
         <Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">${escapeXml(call)}</Data></Cell>
       </Row>`).join('') : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Input Parameters</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
       </Row>
       ${t.inputs.length > 0 ? recursiveRowBuilder(t.inputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
       <Row ss:Height="15"/>
       <Row>
        <Cell ss:StyleID="SubHeader" ss:MergeAcross="4"><Data ss:Type="String">Output Parameters</Data></Cell>
       </Row>
       <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Format</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Struct</Data></Cell>
       </Row>
       ${t.outputs.length > 0 ? recursiveRowBuilder(t.outputs, 0) : '<Row><Cell ss:StyleID="CellBorder" ss:MergeAcross="4"><Data ss:Type="String">None</Data></Cell></Row>'}
       
      </Table>
     </Worksheet>`;
      } catch (e) {
          console.error(`Error generating details sheet for ${t.id}`, e);
      }
    });

    xmlBody += `</Workbook>`;

    const blob = new Blob([xmlBody], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `interface_spec_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewDetails = (t: XmlTransaction) => {
      setSelectedTransaction(t);
      recordAction('接口管理 - 文档管理', `按钮:查看详情 - 查看接口 [${t.id}]`);
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Interface Documentation</h2>
           <p className="text-slate-500 text-sm flex items-center gap-1">
             <Info size={14} className="text-blue-500" />
             <span className="font-medium text-slate-600">提示：请导入网银项目根目录 (Please import the project root directory)</span>
           </p>
        </div>
        
        <div className="flex gap-3">
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                multiple
                // @ts-ignore
                webkitdirectory="" 
                onChange={handleFileUpload}
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
                {isProcessing ? <Activity className="animate-spin" size={18}/> : <Folder size={18} />}
                {isProcessing ? 'Processing...' : 'Load Folder'}
            </button>

            {transactions.length > 0 && (
                <button 
                    onClick={handleExportExcel}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Download size={18} />
                    Export Document (.xls)
                </button>
            )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileJson size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No Interfaces Loaded</h3>
                <p className="text-slate-500 mt-2 max-w-sm">Please select the <strong>online banking project root directory</strong>. We will scan XML configurations, Java files, and Properties files.</p>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-6 text-blue-600 font-medium hover:underline"
                >
                    Browse Files
                </button>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1 relative">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">Module / ID</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Description (CN)</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Implementation</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-center">I/O</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-center">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedTransactions).map(([module, rawTrans]) => {
                    const trans = rawTrans as XmlTransaction[];
                    return (
                        <React.Fragment key={module}>
                            {/* Group Header with Module Name */}
                            <tr className="bg-slate-100">
                                <td colSpan={5} className="px-6 py-2 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={14} />
                                    {module}
                                    <span className="font-normal text-slate-400 ml-2">({trans.length} in this page)</span>
                                </td>
                            </tr>
                            {trans.map(t => (
                                <tr key={`${t.module}-${t.id}`} className="hover:bg-slate-50 group transition-colors">
                                    <td className="px-6 py-3">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-blue-600 font-medium text-sm">{t.id}</span>
                                        <span className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]" title={t.filePath}>
                                          {t.filePath}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="text-slate-800 font-medium">{t.trsName || 'No description'}</div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex flex-col">
                                         <div className="flex items-center gap-1 text-slate-700">
                                            <FileCode size={14} className="text-purple-500"/>
                                            <span className="font-mono text-xs">{t.actionRef}</span>
                                         </div>
                                         <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[250px]" title={t.actionClass}>
                                            {t.actionClass || ''}
                                         </span>
                                         {t.downstreamCalls.length > 0 && (
                                            <div className="flex gap-1 mt-1">
                                                <span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100">
                                                    Calls: {t.downstreamCalls.length}
                                                </span>
                                            </div>
                                         )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center gap-2">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-100" title="Input Fields">
                                                {t.inputs.length}
                                            </span>
                                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-medium border border-purple-100" title="Output Fields">
                                                {t.outputs.length}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <button 
                                            onClick={() => handleViewDetails(t)}
                                            className="text-slate-400 hover:text-blue-600 p-2 rounded hover:bg-blue-50 transition-all"
                                            title="View Details"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
             <div className="text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, transactions.length)} of {transactions.length} entries
             </div>
             <div className="flex items-center gap-2">
                <button 
                   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                   disabled={currentPage === 1}
                   className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-700 px-2">
                   Page {currentPage} of {Math.max(1, totalPages)}
                </span>
                <button 
                   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                   disabled={currentPage === totalPages || totalPages === 0}
                   className="p-2 border border-slate-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                   <ChevronRight size={16} />
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Detailed Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
             {/* Header */}
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
               <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold font-mono text-blue-600">{selectedTransaction.id}</h3>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {selectedTransaction.module}
                    </span>
                  </div>
                  <p className="text-slate-800 mt-1 font-bold text-lg">{selectedTransaction.trsName}</p>
                  <p className="text-slate-500 text-xs mt-1 font-mono">{selectedTransaction.filePath}</p>
                  
                  <div className="flex flex-col mt-3 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                      <div className="flex gap-2 mb-1">
                        <span className="font-bold text-slate-600">Action Ref:</span>
                        <span className="font-mono text-slate-800">{selectedTransaction.actionRef}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-600">Class:</span>
                        <span className="font-mono text-purple-600">{selectedTransaction.actionClass}</span>
                      </div>
                  </div>
               </div>
               <button 
                 onClick={() => setSelectedTransaction(null)}
                 className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-200 transition-colors"
               >
                 <X size={20} />
               </button>
             </div>
             
             {/* Content */}
             <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
               {/* Downstream & Inputs */}
               <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
                 {/* Downstream */}
                 {selectedTransaction.downstreamCalls.length > 0 && (
                     <div>
                         <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
                           <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                           Downstream Interfaces
                         </h4>
                         <div className="bg-amber-50 rounded-lg border border-amber-100 p-3">
                             <ul className="space-y-1">
                                {selectedTransaction.downstreamCalls.map((call, idx) => (
                                    <li key={idx} className="text-xs font-mono text-amber-800 flex items-center gap-2">
                                        <ArrowRightLeft size={10} />
                                        {call}
                                    </li>
                                ))}
                             </ul>
                         </div>
                     </div>
                 )}

                 <div>
                     <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                       <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                       Request Parameters
                     </h4>
                     <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                        <div className="flex text-xs font-semibold text-slate-400 mb-2 px-1">
                            <div className="flex-1">Name / Type</div>
                            <div className="flex-1">Description</div>
                            <div className="flex-1">Style</div>
                        </div>
                        <FieldTree fields={selectedTransaction.inputs} />
                     </div>
                 </div>
               </div>

               {/* Outputs */}
               <div className="flex-1 overflow-y-auto p-6 bg-white">
                 <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                   <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                   Response Parameters
                 </h4>
                 <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <div className="flex text-xs font-semibold text-slate-400 mb-2 px-1">
                        <div className="flex-1">Name / Type</div>
                        <div className="flex-1">Description</div>
                        <div className="flex-1">Type/Info</div>
                    </div>
                    <FieldTree fields={selectedTransaction.outputs} />
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};