import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2 py-2 bg-white">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-600 whitespace-nowrap">每页</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="px-2 py-1 border border-slate-300 rounded-md text-xs bg-white hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <span className="text-slate-600 whitespace-nowrap">
          项 · 共 <span className="font-semibold text-slate-800">{totalItems}</span> 项
        </span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-0.5 px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          title="上一页"
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">上一页</span>
        </button>

        {/* Page Numbers */}
        <div className="flex gap-1">
          {(() => {
            const pageNumbers = new Set<number>();
            const maxVisible = 5;
            
            // Always include first page
            pageNumbers.add(1);
            
            // Add current page and neighbors
            for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
              pageNumbers.add(i);
            }
            
            // Always include last page
            if (totalPages > 1) {
              pageNumbers.add(totalPages);
            }
            
            // Sort and convert to array with ellipsis
            const sortedPages = Array.from(pageNumbers).sort((a, b) => a - b);
            const result: (number | string)[] = [];
            
            sortedPages.forEach((pageNum, idx) => {
              if (idx > 0 && pageNum - sortedPages[idx - 1] > 1) {
                result.push('...');
              }
              result.push(pageNum);
            });
            
            return result.map((item, idx) => 
              typeof item === 'number' ? (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={`min-w-[28px] h-7 px-2 text-xs rounded-md transition-all ${
                    item === currentPage
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'border border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-700'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs">
                  {item}
                </span>
              )
            );
          })()}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-0.5 px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
          title="下一页"
        >
          <span className="hidden sm:inline">下一页</span>
          <ChevronRight size={14} />
        </button>
        
        <span className="ml-1 text-xs text-slate-500 whitespace-nowrap">
          {currentPage}/{totalPages}
        </span>
      </div>
    </div>
  );
};
