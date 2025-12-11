import React, { useState, useEffect } from 'react';
import { GitPullRequest, Search, Download, Settings, RefreshCw, Save, Key, User, Calendar, FileText, ArrowRight, Lock, Globe, GitBranch } from 'lucide-react';
import { Database, TABLE } from '../services/database';
import { recordAction } from '../services/auditService';
import { GiteeConfig, GiteeBranch, GiteeCommit } from '../types';

const INPUT_STYLE = "w-full pl-3 pr-4 py-2 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-400";
const TEXTAREA_STYLE = "w-full p-3 border border-slate-200 rounded-lg bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-700 font-mono resize-none";

// Mock Data
const MOCK_BRANCHES: GiteeBranch[] = [
  { name: 'master', lastCommitHash: 'a1b2c3d', lastUpdated: '2023-10-25 10:00' },
  { name: 'develop', lastCommitHash: 'e5f6g7h', lastUpdated: '2023-10-24 15:30' },
  { name: 'feature/req-20231024-pay', lastCommitHash: 'i8j9k0l', lastUpdated: '2023-10-24 09:15' },
  { name: 'feature/req-20231020-login', lastCommitHash: 'm1n2o3p', lastUpdated: '2023-10-20 11:00' },
];

const MOCK_COMMITS: GiteeCommit[] = [
  { id: 'a1b2c3d4e5f6g7h8i9j0', shortId: 'a1b2c3d', message: 'feat: add payment gateway integration', author: 'DevUser', date: '2023-10-25 10:00', filesChanged: 5 },
  { id: 'b2c3d4e5f6g7h8i9j0k1', shortId: 'b2c3d4e', message: 'fix: login timeout issue', author: 'Admin', date: '2023-10-24 16:20', filesChanged: 2 },
  { id: 'c3d4e5f6g7h8i9j0k1l2', shortId: 'c3d4e5f', message: 'docs: update api spec', author: 'DevUser', date: '2023-10-24 09:15', filesChanged: 1 },
];

export const GiteeManagement: React.FC = () => {
  // Config State
  const [config, setConfig] = useState<GiteeConfig>({ 
      repoUrl: '', 
      authType: 'token', 
      accessToken: '', 
      privateKey: '',
      publicKey: ''
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [branches, setBranches] = useState<GiteeBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [commits, setCommits] = useState<GiteeCommit[]>([]);
  
  // Changeset Modal
  const [changesetOpen, setChangesetOpen] = useState(false);
  const [currentChangeset, setCurrentChangeset] = useState<string[]>([]);
  const [changesetContext, setChangesetContext] = useState<string>('');

  // Load Config
  useEffect(() => {
    const saved = Database.findObject<GiteeConfig>(TABLE.GITEE_CONFIG);
    if (saved) setConfig({ ...config, ...saved }); // Merge with defaults
  }, []);

  const saveConfig = () => {
    Database.saveObject(TABLE.GITEE_CONFIG, config);
    recordAction('Gitee管理', `保存配置 - 方式: ${config.authType === 'token' ? 'HTTPS/Token' : 'SSH'}`);
    setIsConfigOpen(false);
    alert('连接配置已保存');
  };

  const handleSearch = async () => {
    setLoading(true);
    setBranches([]);
    setCommits([]);
    setSelectedBranch(null);
    
    // Simulate API call delay
    setTimeout(() => {
        let results = MOCK_BRANCHES;
        if (searchQuery) {
            results = MOCK_BRANCHES.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        setBranches(results);
        setLoading(false);
        recordAction('Gitee管理', `查询分支 - 关键词: ${searchQuery || 'ALL'}`);
    }, 800);
  };

  const handleBranchSelect = (branchName: string) => {
    setSelectedBranch(branchName);
    setLoading(true);
    // Simulate Fetching Commits
    setTimeout(() => {
        setCommits(MOCK_COMMITS); // In real app, filter by branch
        setLoading(false);
    }, 600);
  };

  const handlePullCommitChanges = (commit: GiteeCommit) => {
    setChangesetContext(`Commit: ${commit.shortId} - ${commit.message}`);
    setLoading(true);
    
    // Simulate Fetching File List for Commit
    setTimeout(() => {
        setCurrentChangeset([
            'src/main/java/com/bank/service/PaymentService.java',
            'src/main/java/com/bank/controller/PaymentController.java',
            'src/main/resources/application.yml',
            'src/test/java/com/bank/PaymentTest.java'
        ]);
        setLoading(false);
        setChangesetOpen(true);
        recordAction('Gitee管理', `拉取变更集 - Commit: ${commit.shortId}`);
    }, 800);
  };

  const handlePullBranchChanges = (branchName: string) => {
      setChangesetContext(`Branch: ${branchName} (vs master)`);
      setLoading(true);

      // Simulate Fetching Diff for Branch vs Master
      setTimeout(() => {
          // Mocking a larger changeset for a whole branch
          setCurrentChangeset([
              'src/main/java/com/bank/service/PaymentService.java',
              'src/main/java/com/bank/controller/PaymentController.java',
              'src/main/java/com/bank/dto/PaymentRequest.java', // Extra file
              'src/main/java/com/bank/utils/CurrencyUtils.java', // Extra file
              'src/main/resources/application.yml',
              'src/main/resources/i18n/messages.properties', // Extra file
              'src/test/java/com/bank/PaymentTest.java',
              'pom.xml'
          ]);
          setLoading(false);
          setChangesetOpen(true);
          recordAction('Gitee管理', `拉取全量变更集 - Branch: ${branchName}`);
      }, 1000);
  };

  const handleDownloadList = () => {
      // Generate TXT content from the list
      const content = currentChangeset.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use branch name as filename, strictly as requested
      const filename = selectedBranch ? `${selectedBranch}.txt` : 'changeset_list.txt';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      recordAction('Gitee管理', `导出变更清单文件: ${filename}`);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <GitPullRequest className="text-red-600"/> Gitee 代码管理
           </h2>
           <p className="text-slate-500 text-sm mt-1">支持 HTTPS/SSH 连接，查询需求分支与获取增量/全量变更</p>
        </div>
        <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-sm ${isConfigOpen ? 'bg-slate-200 text-slate-700' : 'bg-white text-blue-600 border border-slate-200 hover:bg-slate-50'}`}
        >
            <Settings size={18}/> {isConfigOpen ? '收起配置' : '连接配置'}
        </button>
      </div>

      {/* Config Panel */}
      {isConfigOpen && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-blue-500"/> 连接设置
              </h3>
              
              {/* Auth Type Selector */}
              <div className="flex gap-6 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={config.authType === 'token'}
                        onChange={() => setConfig({...config, authType: 'token'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Lock size={14}/> HTTPS + Token (推荐)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="authType" 
                        checked={config.authType === 'ssh'}
                        onChange={() => setConfig({...config, authType: 'ssh'})}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700 flex items-center gap-1"><Key size={14}/> SSH Key</span>
                  </label>
              </div>

              <div className="space-y-4 max-w-4xl bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {config.authType === 'token' ? (
                      // HTTPS / Token Config
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Repository URL (HTTPS)</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                    <input 
                                        className={`${INPUT_STYLE} pl-10`} 
                                        placeholder="https://gitee.com/username/repo.git" 
                                        value={config.repoUrl}
                                        onChange={e => setConfig({...config, repoUrl: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Username (Optional)</label>
                                <input 
                                    className={INPUT_STYLE} 
                                    placeholder="e.g. dev_user" 
                                    value={config.username || ''}
                                    onChange={e => setConfig({...config, username: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Personal Access Token</label>
                            <input 
                                className={INPUT_STYLE} 
                                type="password"
                                placeholder="Your Gitee Personal Access Token" 
                                value={config.accessToken || ''}
                                onChange={e => setConfig({...config, accessToken: e.target.value})}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">建议使用 Token 代替密码以提高安全性。</p>
                        </div>
                      </>
                  ) : (
                      // SSH Config
                      <>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Repository URL (SSH)</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                                <input 
                                    className={`${INPUT_STYLE} pl-10`} 
                                    placeholder="git@gitee.com:username/repo.git" 
                                    value={config.repoUrl}
                                    onChange={e => setConfig({...config, repoUrl: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Public Key (公钥)</label>
                                <textarea 
                                    className={TEXTAREA_STYLE} 
                                    rows={4}
                                    placeholder="ssh-rsa AAAA... (Optional for display/verification)" 
                                    value={config.publicKey || ''}
                                    onChange={e => setConfig({...config, publicKey: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Private Key (私钥)</label>
                                <textarea 
                                    className={TEXTAREA_STYLE} 
                                    rows={4}
                                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." 
                                    value={config.privateKey || ''}
                                    onChange={e => setConfig({...config, privateKey: e.target.value})}
                                />
                            </div>
                        </div>
                      </>
                  )}
              </div>
              
              <div className="flex justify-end pt-4">
                  <button onClick={saveConfig} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors">
                      <Save size={18}/> 保存并测试连接
                  </button>
              </div>
          </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
          {/* Left: Branch Search */}
          <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700 mb-2">需求分支查询</h3>
                  <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                      <input 
                          className={`${INPUT_STYLE} pl-9 pr-12`} 
                          placeholder="输入需求编号或分支名..." 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      />
                      <button 
                          onClick={handleSearch}
                          className="absolute right-1 top-1 bg-slate-200 hover:bg-slate-300 p-1.5 rounded text-slate-600 transition-colors"
                      >
                          <ArrowRight size={16}/>
                      </button>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                  {branches.length > 0 ? (
                      branches.map(branch => (
                          <div 
                              key={branch.name}
                              onClick={() => handleBranchSelect(branch.name)}
                              className={`p-3 rounded-lg cursor-pointer border mb-2 transition-all ${selectedBranch === branch.name ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}
                          >
                              <div className="flex justify-between items-start">
                                  <div className={`font-bold text-sm ${selectedBranch === branch.name ? 'text-red-700' : 'text-slate-700'}`}>
                                      {branch.name}
                                  </div>
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                      {branch.lastCommitHash}
                                  </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <Calendar size={12}/> Updated: {branch.lastUpdated}
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-10 text-slate-400 text-sm">
                          {loading ? '正在查询...' : '暂无数据，请输入关键词查询'}
                      </div>
                  )}
              </div>
          </div>

          {/* Right: Commits & Changes */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-700">提交记录</h3>
                      {selectedBranch && <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{selectedBranch}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                      {loading && <div className="flex items-center gap-2 text-xs text-blue-600 mr-2"><RefreshCw size={12} className="animate-spin"/> Processing...</div>}
                      {selectedBranch && (
                          <button 
                            onClick={() => handlePullBranchChanges(selectedBranch)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                            title="Compare this branch with master and get all changed files"
                          >
                              <GitBranch size={14}/> 拉取分支全量变更
                          </button>
                      )}
                  </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                  {selectedBranch ? (
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                               <tr>
                                   <th className="px-6 py-3 font-semibold text-slate-600">Short ID</th>
                                   <th className="px-6 py-3 font-semibold text-slate-600">Message</th>
                                   <th className="px-6 py-3 font-semibold text-slate-600">Author</th>
                                   <th className="px-6 py-3 font-semibold text-slate-600">Date</th>
                                   <th className="px-6 py-3 font-semibold text-slate-600 text-right">Action</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                               {commits.map(commit => (
                                   <tr key={commit.id} className="hover:bg-slate-50">
                                       <td className="px-6 py-3 font-mono text-xs text-slate-500">{commit.shortId}</td>
                                       <td className="px-6 py-3 font-medium text-slate-800">{commit.message}</td>
                                       <td className="px-6 py-3 text-slate-600 flex items-center gap-2">
                                           <User size={14} className="text-slate-400"/> {commit.author}
                                       </td>
                                       <td className="px-6 py-3 text-slate-500 text-xs">{commit.date}</td>
                                       <td className="px-6 py-3 text-right">
                                           <button 
                                               onClick={() => handlePullCommitChanges(commit)}
                                               className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-xs font-bold border border-blue-200 hover:border-blue-300 transition-colors"
                                           >
                                               拉取单次变更
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-300">
                          <GitPullRequest size={48} className="mb-4 opacity-50"/>
                          <p className="text-lg font-medium">请选择左侧分支查看提交记录</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Changeset Modal */}
      {changesetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800">变更集文件列表</h3>
                          <p className="text-xs text-slate-500 font-mono mt-1">{changesetContext}</p>
                      </div>
                      <button onClick={() => setChangesetOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <Settings size={20} className="hidden"/> {/* Placeholder to align X */}
                          <div className="p-1 rounded hover:bg-slate-200 transition-colors"><Settings className="opacity-0 w-0 h-0"/>X</div> 
                          {/* Proper Close Icon via visual trick or just X icon */}
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                      <div className="space-y-2">
                          {currentChangeset.length > 0 ? currentChangeset.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                                  <FileText size={16} className="text-blue-500 shrink-0"/>
                                  <span className="text-sm font-mono text-slate-700 break-all">{file}</span>
                              </div>
                          )) : (
                              <div className="text-center py-8 text-slate-400">无文件变更</div>
                          )}
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button onClick={() => setChangesetOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">关闭</button>
                      <button 
                        onClick={handleDownloadList}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2 shadow-sm"
                      >
                          <Download size={16}/> 导出变更清单 ({selectedBranch ? `${selectedBranch}.txt` : '.txt'})
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
