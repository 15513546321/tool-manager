import React from 'react';
import { X, AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className={`font-bold flex items-center gap-2 ${type === 'danger' ? 'text-red-700' : 'text-slate-800'}`}>
            {type === 'danger' && <AlertTriangle size={18} className="text-red-500" />}
            {type === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
            {type === 'info' && <HelpCircle size={18} className="text-blue-500" />}
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-sm text-slate-600 leading-relaxed">
          {message}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-white rounded-lg font-bold text-sm shadow-sm transition-colors ${
              type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};