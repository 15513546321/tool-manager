import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './src/globals.css';
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
import { Megaphone, ArrowRight, X, Clock, FileText, Download } from 'lucide-react';
import { Database, TABLE } from './services/database';
import { announcementApi } from './services/apiService';
import { initializeAuditButtonTracking } from './services/auditButton';

interface AnnouncementStatus {
  clientIp: string;
  currentAnnouncementVersion: string;
  lastSeenAnnouncementVersion: string | null;
  needsDisplay: boolean;
  announcement?: any;
}

const Dashboard = () => {
  const [announcement, setAnnouncement] = useState<any>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check announcement status from backend API
    const checkAnnouncementStatus = async () => {
      try {
        const data = await announcementApi.checkStatus();
        if (data.needsDisplay && data.announcement) {
          setAnnouncement({
            title: data.announcement.title,
            description: data.announcement.description,
            versions: [
              {
                updatedAt: data.announcement.updatedAt,
                versionNumber: data.announcement.version,
                fileName: data.announcement.fileName || '',
                fileContent: data.announcement.content || ''
              }
            ]
          });
          setShowAnnouncementModal(true);
        } else if (data.announcement) {
          // Still load announcement for display, just don't force modal
          setAnnouncement({
            title: data.announcement.title,
            description: data.announcement.description,
            versions: [
              {
                updatedAt: data.announcement.updatedAt,
                versionNumber: data.announcement.version,
                fileName: data.announcement.fileName || '',
                fileContent: data.announcement.content || ''
              }
            ]
          });
        }
      } catch (error) {
        console.error('Failed to fetch announcement status from backend:', error);
      }
    };
    checkAnnouncementStatus();
  }, []);

  const handleCloseAnnouncementModal = async () => {
    try {
      await announcementApi.recordView();
      setShowAnnouncementModal(false);
    } catch (error) {
      console.error('Failed to record announcement view:', error);
      setShowAnnouncementModal(false);
    }
  };

  const handleDownloadAnnouncement = (version: any) => {
    if (!version.fileContent || !version.fileName) {
      alert('无可下载的文件');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = version.fileContent;
      link.download = version.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败，请重试');
    }
  };

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
            className="relative mb-10 group cursor-pointer overflow-hidden rounded-2xl transition-all duration-500 hover:shadow-xl"
        >
          {/* Light Blue Background - Professional and Eye-catching */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 group-hover:from-blue-100 group-hover:via-cyan-100 group-hover:to-blue-200 transition-all duration-500"></div>
          
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400"></div>
          
          {/* Decorative Elements */}
          <div className="absolute -right-40 -top-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute -left-40 -bottom-40 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl group-hover:scale-105 transition-transform duration-700"></div>
          
          {/* Main Content Container */}
          <div className="relative z-10 p-8 flex items-start gap-6">
            {/* Icon Container */}
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-md shrink-0 border border-blue-200 group-hover:bg-white/90 group-hover:shadow-lg transition-all duration-300">
              <Megaphone className="w-8 h-8 text-blue-600" />
            </div>

            {/* Text Content */}
            <div className="flex-1">
              {/* Badges Row */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="bg-white/80 backdrop-blur-sm text-blue-600 text-[11px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-300 shadow-sm group-hover:bg-white transition-all duration-300">
                  📢 最新公告
                </span>
                <span className="text-blue-700 text-xs font-mono bg-white/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-blue-200">
                  {announcement.versions?.[0]?.updatedAt?.split(' ')[0]}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-3 leading-tight text-blue-900 group-hover:text-blue-800 transition-all duration-300">
                {announcement.title}
              </h3>

              {/* Description */}
              <p className="text-blue-800 text-base leading-relaxed max-w-3xl line-clamp-2 mb-4">
                {announcement.description || '点击查看完整内容...'}
              </p>

              {/* Action Hint */}
              <div className="flex items-center gap-2 text-blue-700 text-sm group-hover:text-blue-900 transition-all duration-300 font-medium">
                <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-300" />
                <span>点击进入公告详情</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
         <div className="bg-blue-50 rounded-xl p-8 text-center border border-blue-200 mb-10">
            <Megaphone className="mx-auto text-blue-400 mb-2" size={32} />
            <p className="text-blue-600 font-medium">暂无最新公告</p>
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
      {showAnnouncementModal && announcement && (
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
                     onClick={handleCloseAnnouncementModal} // Use new handler
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
                       {announcement.versions[0]?.fileName && (
                         <span className="flex items-center gap-1">
                             <FileText size={12}/> 
                             包含附件
                         </span>
                       )}
                   </div>

                   <div className="text-slate-600 text-sm leading-relaxed max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-100">
                       {announcement.description || '暂无详细内容'}
                   </div>
               </div>
               
               {/* Footer */}
               <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                   <button 
                     onClick={handleCloseAnnouncementModal} // Use new handler
                     className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium hover:bg-slate-200 rounded-lg transition-colors"
                   >
                     关闭
                   </button>
                   {announcement.versions[0]?.fileName && announcement.versions[0]?.fileContent && (
                     <button 
                       onClick={() => handleDownloadAnnouncement(announcement.versions[0])}
                       className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                     >
                       <Download size={14}/> 下载附件
                     </button>
                   )}
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
  // 🔧 初始化全局按钮点击审计追踪
  useEffect(() => {
    initializeAuditButtonTracking();
  }, []);

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