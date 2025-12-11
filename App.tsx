import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { MenuManagement } from './pages/MenuManagement';
import { DocManagement } from './pages/interface/DocManagement';
import { CodeGenerator } from './pages/interface/CodeGenerator';
import { ParameterConfigPage } from './pages/ParameterConfig';
import { DocRepository } from './pages/DocRepository';
import { Announcement } from './pages/Announcement';
import { AuditLog } from './pages/AuditLog';
import { FormatTools } from './pages/FormatTools';
import { GitlabReports } from './pages/GitlabReports';
import { GiteeManagement } from './pages/GiteeManagement';
import { NacosSync } from './pages/sync/NacosSync';
import { OracleSync } from './pages/sync/OracleSync';
import { IpConfig } from './pages/admin/IpConfig';
import { Suggestions } from './pages/Suggestions';
import { Megaphone, ArrowRight, X, Clock, FileText } from 'lucide-react';
import { Database, TABLE } from './services/database';

const Dashboard = () => {
  const [announcement, setAnnouncement] = React.useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    // No need to fetch client IP - backend handles it automatically
    try {
      const list = Database.findAll<any>(TABLE.ANNOUNCEMENTS);
      if (list.length > 0) {
        const latest = list[0]; // Assuming first is latest
        setAnnouncement(latest);
        
        // Check if user has seen announcement in this session
        const hasSeen = sessionStorage.getItem('has_seen_notice');
        if (!hasSeen) {
            setShowModal(true);
            sessionStorage.setItem('has_seen_notice', 'true');
        }
      }
    } catch(e) {}
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500 relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">工作台 (Dashboard)</h1>
        <p className="text-slate-600 mt-2">欢迎回来，开始您高效的一天。</p>
      </div>

      {/* Elegant Announcement Card */}
      {announcement ? (
        <div 
            onClick={() => navigate('/announcement')}
            className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-8 text-white shadow-xl mb-10 relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]"
        >
          {/* Decorative Background Icon */}
          <div className="absolute -right-6 -top-6 text-white opacity-10 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
             <Megaphone size={160} />
          </div>

          <div className="relative z-10 flex items-start gap-5">
             <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm shadow-inner shrink-0">
               <Megaphone className="w-8 h-8 text-white" />
             </div>
             <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <span className="bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
                     Latest Notice
                   </span>
                   <span className="text-blue-100 text-xs font-mono bg-blue-900/30 px-2 py-1 rounded">
                     {announcement.versions?.[0]?.updatedAt?.split(' ')[0]}
                   </span>
                </div>
                <h3 className="text-2xl font-bold mb-2 leading-tight">{announcement.title}</h3>
                <p className="text-blue-100 text-sm leading-relaxed max-w-2xl line-clamp-2">
                  {announcement.description || '暂无详细描述...'}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-200 group-hover:text-white transition-colors">
                   查看详情 <ArrowRight size={14} />
                </div>
             </div>
          </div>
        </div>
      ) : (
         <div className="bg-slate-100 rounded-xl p-8 text-center border-2 border-dashed border-slate-300 mb-10">
            <Megaphone className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-slate-500 font-medium">暂无最新公告</p>
         </div>
      )}

      {/* Quick Stats / Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="font-bold text-slate-700 mb-2">接口管理</h3>
            <p className="text-sm text-slate-500 mb-4">快速访问文档与代码生成工具。</p>
            <button onClick={() => navigate('/interface/docs')} className="text-blue-600 text-sm font-bold hover:underline">Go to Docs &rarr;</button>
         </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="font-bold text-slate-700 mb-2">知识库</h3>
            <p className="text-sm text-slate-500 mb-4">浏览最新的技术规范与业务文档。</p>
            <button onClick={() => navigate('/repo')} className="text-blue-600 text-sm font-bold hover:underline">Browse Repo &rarr;</button>
         </div>
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="font-bold text-slate-700 mb-2">审计日志</h3>
            <p className="text-sm text-slate-500 mb-4">查看系统操作记录与安全监控。</p>
            <button onClick={() => navigate('/audit')} className="text-blue-600 text-sm font-bold hover:underline">View Logs &rarr;</button>
         </div>
      </div>

      {/* Announcement Modal (First Login) */}
      {showModal && announcement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
               {/* Header */}
               <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                       <Megaphone size={100} className="text-white"/>
                   </div>
                   <h2 className="text-xl font-bold text-white flex items-center gap-2 relative z-10">
                       <Megaphone size={20} className="text-yellow-300"/> 最新公告
                   </h2>
                   <button 
                     onClick={() => setShowModal(false)}
                     className="text-white/70 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors relative z-10"
                   >
                     <X size={20} />
                   </button>
               </div>
               
               {/* Body */}
               <div className="p-6">
                   <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-slate-800 leading-snug">{announcement.title}</h3>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full whitespace-nowrap ml-2">v{announcement.versions[0]?.versionNumber}</span>
                   </div>
                   
                   <div className="flex items-center gap-4 text-xs text-slate-400 mb-4 pb-4 border-b border-slate-100">
                       <span className="flex items-center gap-1"><Clock size={12}/> {announcement.versions[0]?.updatedAt}</span>
                       <span className="flex items-center gap-1">
                           <FileText size={12}/> 
                           {announcement.versions[0]?.fileName ? '包含附件' : '无附件'}
                       </span>
                   </div>

                   <div className="text-slate-600 text-sm leading-relaxed max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-100">
                       {announcement.description || '暂无详细内容'}
                   </div>
               </div>
               
               {/* Footer */}
               <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                   <button 
                     onClick={() => setShowModal(false)}
                     className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors"
                   >
                     关闭
                   </button>
                   <button 
                     onClick={() => navigate('/announcement')}
                     className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors flex items-center gap-2"
                   >
                     前往查看 <ArrowRight size={14}/>
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* Admin Menu Management */}
          <Route path="admin/menus" element={<MenuManagement />} />
          <Route path="admin/ip-config" element={<IpConfig />} />
          
          {/* Interface Management */}
          <Route path="interface/docs" element={<DocManagement />} />
          <Route path="interface/code" element={<CodeGenerator />} />
          
          {/* New Format Tools */}
          <Route path="format" element={<FormatTools />} />
          
          {/* New GitLab Reports */}
          <Route path="gitlab-reports" element={<GitlabReports />} />
          <Route path="gitee" element={<GiteeManagement />} />
          
          {/* Removed Diff Tool */}

          {/* New Sync Tools */}
          <Route path="sync/nacos" element={<NacosSync />} />
          <Route path="sync/oracle" element={<OracleSync />} />

          {/* Parameter Config */}
          <Route path="params" element={<ParameterConfigPage />} />
          
          {/* Doc Repo */}
          <Route path="repo" element={<DocRepository />} />

          {/* New Features */}
          <Route path="announcement" element={<Announcement />} />
          <Route path="audit" element={<AuditLog />} />
          
          {/* Suggestions */}
          <Route path="suggestions" element={<Suggestions />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;