import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './src/globals.css';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { MenuManagement } from './pages/MenuManagement';
import { DocManagement } from './pages/interface/DocManagement';
import { CodeGenerator } from './pages/interface/CodeGenerator';
import { MockPacketGenerator } from './pages/interface/MockPacketGenerator';
import { ParameterConfigPage } from './pages/ParameterConfig';
import { DocRepository } from './pages/DocRepository';
import { Announcement } from './pages/Announcement';
import { AuditLog } from './pages/AuditLog';
import { FormatTools } from './pages/FormatTools';
import { RefreshCache } from './pages/RefreshCache'
import { FieldConfigTool } from './pages/FieldConfigTool';
import { GitlabReports } from './pages/GitlabReports';
import { GiteeManagement } from './pages/GiteeManagement';
import { ReleaseChanges } from './pages/ReleaseChanges';
import { ChangeStepCheck } from './pages/ChangeStepCheck';
import { NacosSync } from './pages/sync/NacosSync';
import { OracleSync } from './pages/sync/OracleSync';
import { IpConfig } from './pages/admin/IpConfig';
import { UserManagement } from './pages/admin/UserManagement';
import { RoleManagement } from './pages/admin/RoleManagement';
import { PermissionManagement } from './pages/admin/PermissionManagement';
import { Suggestions } from './pages/Suggestions';
import {
  Megaphone,
  ArrowRight,
  X,
  Clock,
  FileText,
  Download,
  FileCode,
  BookOpen,
  GitPullRequest,
  RefreshCw,
  FileCheck,
  Database as DatabaseIcon,
} from 'lucide-react';
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

  const quickActions = [
    {
      title: '接口资产',
      caption: '文档、代码生成、模拟报文',
      path: '/interface/docs',
      icon: FileCode,
      tone: 'text-blue-700 bg-blue-50 border-blue-100',
    },
    {
      title: '交付变更',
      caption: '变更集录入与比包对账',
      path: '/release-changes/dev',
      icon: GitPullRequest,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
    },
    {
      title: '运维配置',
      caption: '同步、参数与缓存刷新',
      path: '/sync/nacos',
      icon: RefreshCw,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      title: '治理审计',
      caption: '日志、权限、菜单与 IP 映射',
      path: '/audit',
      icon: FileCheck,
      tone: 'text-sky-700 bg-sky-50 border-sky-100',
    },
  ];

  const focusItems = [
    { label: '知识库', value: '规范与业务文档', path: '/repo', icon: BookOpen },
    { label: '参数配置', value: '系统参数维护', path: '/params', icon: DatabaseIcon },
    { label: '公告通知', value: '平台发布记录', path: '/announcement', icon: Megaphone },
  ];

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
    <div className="mx-auto max-w-7xl px-8 py-8 animate-in fade-in duration-500">
      <section className="mb-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-amber-400 to-emerald-500" />
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-3 text-xs font-semibold text-blue-700">工作概览</p>
              <h2 className="text-3xl font-semibold tracking-normal text-blue-950">工作台</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                接口资产、交付变更、运维配置与系统治理集中处理。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {focusItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="rounded-md border border-blue-100 bg-blue-50/50 px-3 py-3 text-left transition-all hover:border-blue-200 hover:bg-white hover:shadow-sm"
                  >
                    <Icon size={16} className="mb-2 text-blue-700" />
                    <div className="text-sm font-semibold text-blue-950">{item.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.value}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/announcement')}
          className="group flex min-h-[190px] flex-col justify-between rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="rounded-md bg-blue-700 p-3 text-white shadow-[0_10px_24px_rgba(29,78,216,0.18)]">
              <Megaphone size={22} />
            </div>
            <ArrowRight size={18} className="text-blue-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-700" />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-blue-700">
              <span>最新公告</span>
              {announcement?.versions?.[0]?.updatedAt && (
                <span className="text-slate-400">/ {announcement.versions[0].updatedAt.split(' ')[0]}</span>
              )}
            </div>
            <h3 className="line-clamp-2 text-xl font-semibold tracking-normal text-blue-950">
              {announcement?.title || '暂无公告'}
            </h3>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
              {announcement?.description || '公告发布后将在这里显示。'}
            </p>
          </div>
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="group rounded-lg border border-blue-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-md border ${action.tone}`}>
                <Icon size={19} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-blue-950">{action.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{action.caption}</p>
                </div>
                <ArrowRight size={17} className="shrink-0 text-blue-200 transition-transform group-hover:translate-x-1 group-hover:text-blue-700" />
              </div>
            </button>
          );
        })}
      </section>

      {/* Announcement Modal (First Login) */}
      {showAnnouncementModal && announcement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/45 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-lg shadow-lg overflow-hidden animate-in zoom-in-95 duration-300">
               {/* Header */}
               <div className="bg-blue-700 px-6 py-4 flex justify-between items-center relative overflow-hidden">
                   <h2 className="text-lg font-semibold text-white flex items-center gap-2 relative z-10">
                       <Megaphone size={20} className="text-amber-200"/> 最新公告
                   </h2>
                   <button 
                     onClick={handleCloseAnnouncementModal} // Use new handler
                     className="text-white/70 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors relative z-10"
                   >
                     <X size={20} />
                   </button>
               </div>
               
               {/* Body */}
               <div className="p-6">
                   <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-blue-950 leading-snug">{announcement.title}</h3>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md whitespace-nowrap ml-2">v{announcement.versions[0]?.versionNumber}</span>
                   </div>
                   
                   <div className="flex items-center gap-4 text-xs text-zinc-400 mb-4 pb-4 border-b border-zinc-100">
                       <span className="flex items-center gap-1"><Clock size={12}/> {announcement.versions[0]?.updatedAt}</span>
                       {announcement.versions[0]?.fileName && (
                         <span className="flex items-center gap-1">
                             <FileText size={12}/> 
                             包含附件
                         </span>
                       )}
                   </div>

                   <div className="text-zinc-600 text-sm leading-relaxed max-h-60 overflow-y-auto bg-zinc-50 p-4 rounded-md border border-zinc-100">
                       {announcement.description || '暂无详细内容'}
                   </div>
               </div>
               
               {/* Footer */}
               <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
                   <button 
                     onClick={handleCloseAnnouncementModal} // Use new handler
                     className="px-4 py-2 text-zinc-500 hover:text-zinc-700 text-sm font-medium hover:bg-zinc-200 rounded-md transition-colors"
                   >
                     关闭
                   </button>
                   {announcement.versions[0]?.fileName && announcement.versions[0]?.fileContent && (
                     <button 
                       onClick={() => handleDownloadAnnouncement(announcement.versions[0])}
                       className="px-4 py-2 bg-white border border-zinc-200 text-zinc-600 text-sm font-medium rounded-md hover:bg-zinc-100 transition-colors flex items-center gap-2"
                     >
                       <Download size={14}/> 下载附件
                     </button>
                   )}
                   <button 
                     onClick={() => navigate('/announcement')}
                     className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md shadow-lg shadow-blue-700/20 hover:bg-blue-800 transition-colors flex items-center gap-2"
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
          <Route path="admin/users" element={<UserManagement />} />
          <Route path="admin/roles" element={<RoleManagement />} />
          <Route path="admin/permissions" element={<PermissionManagement />} />
          
          {/* Interface Management */}
          <Route path="interface/docs" element={<DocManagement />} />
          <Route path="interface/code" element={<CodeGenerator />} />
          <Route path="interface/mock-packet" element={<MockPacketGenerator />} />
          
          {/* New Format Tools */}
          <Route path="format" element={<FormatTools />} />

          <Route path="field" element={<FieldConfigTool />} />

          {/* New GitLab Reports */}
          <Route path="gitlab-reports" element={<GitlabReports />} />
          <Route path="gitee" element={<GiteeManagement />} />
          <Route path="release-changes" element={<Navigate to="/release-changes/dev" replace />} />
          <Route path="release-changes/dev" element={<ReleaseChanges mode="developer" />} />
          <Route path="release-changes/manager" element={<ReleaseChanges mode="manager" />} />
          <Route path="release-changes/check" element={<ChangeStepCheck />} />
          
          {/* Removed Diff Tool */}

          {/* New Sync Tools */}
          <Route path="sync/nacos" element={<NacosSync />} />
          <Route path="sync/oracle" element={<OracleSync />} />

          {/* Parameter Config */}
          <Route path="params" element={<ParameterConfigPage />} />

          {/* refresh Config */}
          <Route path="/refresh" element={<RefreshCache />} />

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
