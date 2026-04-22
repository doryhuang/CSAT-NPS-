import React from 'react';
import { Feedback } from '../types';
import { cn } from '../lib/utils';
import { CheckSquare, Square, ExternalLink } from 'lucide-react';

interface FeedbackTableProps {
  data: Feedback[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  mode: 'csat-nps' | 'chat-duration';
}

const categoryColors: Record<string, string> = {
  Inquiry: "bg-blue-50 text-blue-600 border-blue-100",
  Issue: "bg-red-50 text-red-600 border-red-100",
  Request: "bg-emerald-50 text-emerald-600 border-emerald-100"
};

export const FeedbackTable: React.FC<FeedbackTableProps> = ({ data, selectedIds, onToggleSelect, onSelectAll, mode }) => {
  const allSelected = data.length > 0 && selectedIds.size === data.length;

  return (
    <div className="bg-white rounded-xl border border-morandi-yellow-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-morandi-yellow-50 border-b border-morandi-yellow-100">
            <tr>
              <th className="p-4 w-12">
                <button 
                  onClick={onSelectAll}
                  className="text-slate-400 hover:text-morandi-yellow-600 transition-colors"
                >
                  {allSelected ? <CheckSquare size={20} className="text-morandi-yellow-600" /> : <Square size={20} />}
                </button>
              </th>
              {mode === 'chat-duration' && (
                <>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center">項目</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32">工單 ID</th>
                </>
              )}
              {mode === 'csat-nps' && (
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">評分</th>
              )}
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider pl-8">內容摘要</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((f) => (
              <tr 
                key={f.id} 
                className={cn(
                  "hover:bg-morandi-yellow-50/30 transition-colors cursor-pointer",
                  selectedIds.has(f.id) ? "bg-morandi-yellow-50" : ""
                )}
                onClick={() => onToggleSelect(f.id)}
              >
                <td className="p-4">
                  <div className="text-slate-400">
                    {selectedIds.has(f.id) ? <CheckSquare size={20} className="text-morandi-yellow-600" /> : <Square size={20} />}
                  </div>
                </td>
                {mode === 'chat-duration' && (
                  <>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                        f.category ? (categoryColors[f.category] || "bg-slate-100 text-slate-600 border-slate-200") : "text-slate-300 border-transparent"
                      )}>
                        {f.category || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <a 
                        href={`https://furbo.zendesk.com/agent/tickets/${f.ticketId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-morandi-yellow-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{f.ticketId}
                      </a>
                    </td>
                  </>
                )}
                {mode === 'csat-nps' && (
                  <td className="p-4">
                    <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded w-full text-center whitespace-nowrap",
                        f.csat >= 4 ? "bg-[#4CAF7A]/10 text-[#4CAF7A]" : f.csat <= 2 ? "bg-[#D96C5F]/10 text-[#D96C5F]" : "bg-[#B7A980]/10 text-[#B7A980]"
                      )}>CSAT: {f.csat}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded w-full text-center whitespace-nowrap",
                        f.nps >= 9 ? "bg-[#4CAF7A]/10 text-[#4CAF7A]" : f.nps <= 6 ? "bg-[#D96C5F]/10 text-[#D96C5F]" : "bg-[#B7A980]/10 text-[#B7A980]"
                      )}>NPS: {f.nps}</span>
                    </div>
                  </td>
                )}
                <td className="p-4 pl-8">
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        {mode === 'csat-nps' ? '工單評論' : '對話詳細內容'}
                      </span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{f.ticketComment || '(無內容)'}</p>
                    </div>
                    {mode === 'csat-nps' && (
                      <>
                        <div className="bg-indigo-50/30 p-2 rounded border border-indigo-100/50">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">NPS 評論</span>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{f.npsComment || '(無內容)'}</p>
                        </div>
                        <div className="bg-amber-50/30 p-2 rounded border border-amber-100/50">
                          <span className="text-[10px] font-bold text-amber-400 uppercase block mb-1">改進建議</span>
                          <p className="text-sm text-slate-700 italic whitespace-pre-wrap">{f.howToImprove || '(無內容)'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
