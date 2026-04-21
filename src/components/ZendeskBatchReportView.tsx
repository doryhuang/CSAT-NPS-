import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Hash,
  Clock,
  ExternalLink,
  Edit2,
  Check
} from 'lucide-react';
import { ZendeskIndividualReport, ZendeskBatchSummary } from '../types';
import { cn } from '../lib/utils';

interface ZendeskBatchReportViewProps {
  batchSummary: ZendeskBatchSummary;
  individualReports: ZendeskIndividualReport[];
  selectedTicketIds: Set<string>;
  isSharedView?: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onUpdateReports?: (updated: ZendeskIndividualReport[]) => void;
}

export const ZendeskBatchReportView: React.FC<ZendeskBatchReportViewProps> = ({ 
  batchSummary, 
  individualReports,
  selectedTicketIds,
  isSharedView = false,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateReports
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string, field: keyof ZendeskIndividualReport } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Inquiry' | 'Issue' | 'Request'>('All');

  const toggleSelect = onToggleSelect;
  const toggleSelectAll = onToggleSelectAll;

  const filteredReports = individualReports.filter(r => {
    const isSelected = selectedTicketIds.has(r.ticketId);
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
    return isSelected && matchesCategory;
  });

  const categories = ['All', 'Inquiry', 'Issue', 'Request'] as const;

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleUpdateField = (id: string, field: keyof ZendeskIndividualReport, value: any) => {
    if (!onUpdateReports) return;
    const next = individualReports.map(r => 
      r.ticketId === id ? { ...r, [field]: value } : r
    );
    onUpdateReports(next);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Summary Analysis Section */}
      <section className="bg-white rounded-3xl border border-morandi-yellow-100 shadow-xl overflow-hidden">
        <div className="bg-morandi-yellow-600 p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Efficiency & Timeout Analysis Report</span>
          </div>
          <h2 className="text-4xl font-black tracking-tight mb-4">Chat Duration 超時原因分析報告</h2>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
            <div className="flex flex-wrap gap-2">
              {batchSummary.caseIds.map(id => (
                <a 
                  key={id} 
                  href={`https://furbo.zendesk.com/agent/tickets/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold hover:bg-white/40 transition-colors flex items-center gap-1"
                >
                  #{id}
                  <ExternalLink size={10} />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    categoryFilter === cat 
                      ? "bg-white text-morandi-yellow-600 shadow-sm" 
                      : "text-white/70 hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-10">
          {/* Efficiency Summary Table (Figure 2 Style) */}
          <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-morandi-yellow-50/50 border-b border-slate-200">
                  <th className="p-4 text-sm font-bold text-slate-700 w-28 text-center border-r border-slate-200">Ticket Type</th>
                  <th className="p-4 text-sm font-bold text-slate-700 w-24 text-center border-r border-slate-200">工單號</th>
                  <th className="p-4 text-sm font-bold text-slate-700 w-28 text-center border-r border-slate-200">時長</th>
                  <th className="p-4 text-sm font-bold text-slate-700 border-r border-slate-200 w-[38%]">案件說明</th>
                  <th className="p-4 text-sm font-bold text-slate-700 w-[38%]">To do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredReports.map((report) => (
                  <tr key={report.ticketId} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="p-4 text-center border-r border-slate-100">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-black uppercase",
                        report.category === 'Inquiry' ? "bg-blue-100 text-blue-600" :
                        report.category === 'Request' ? "bg-purple-100 text-purple-600" :
                        "bg-orange-100 text-orange-600"
                      )}>
                        {report.category || 'Issue'}
                      </span>
                    </td>
                    <td className="p-4 text-center border-r border-slate-100 font-mono text-sm">
                      <a 
                        href={`https://furbo.zendesk.com/agent/tickets/${report.ticketId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-bold hover:underline"
                      >
                        {report.ticketId}
                      </a>
                    </td>
                    <td className="p-4 text-center border-r border-slate-100">
                      <div className="flex items-center justify-center gap-2">
                        {editingCell?.id === report.ticketId && editingCell.field === 'durationMinutes' ? (
                          <input 
                            type="number"
                            autoFocus
                            className="w-16 p-1 border rounded text-center text-sm"
                            value={report.durationMinutes}
                            onChange={(e) => handleUpdateField(report.ticketId, 'durationMinutes', parseInt(e.target.value) || 0)}
                            onBlur={() => setEditingCell(null)}
                          />
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded font-bold text-slate-700 flex items-center gap-1"
                            onClick={() => setEditingCell({ id: report.ticketId, field: 'durationMinutes' })}
                          >
                            {report.durationMinutes} 分鐘
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 border-r border-slate-100">
                      <div 
                        className="cursor-pointer hover:bg-slate-50 p-2 rounded text-sm leading-relaxed whitespace-pre-wrap transition-colors text-slate-600 min-h-[40px] border border-transparent hover:border-slate-200"
                        onClick={() => setEditingCell({ id: report.ticketId, field: 'caseDescription' })}
                      >
                        {report.caseDescription || '(點擊填寫說明)'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div 
                        className="cursor-pointer hover:bg-slate-50 p-2 rounded text-sm text-slate-600 leading-relaxed whitespace-pre-wrap min-h-[40px] border border-transparent hover:border-slate-200"
                        onClick={() => setEditingCell({ id: report.ticketId, field: 'todoItems' })}
                      >
                        {report.todoItems || '(點擊填寫待辦)'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
            {/* Summary */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-morandi-yellow-600">
                <FileText size={20} />
                <h3 className="text-lg font-bold">效率總體摘要</h3>
              </div>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
                {batchSummary.ticketSummary}
              </p>
            </div>

            {/* Opportunity */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <Lightbulb size={24} />
                <h3 className="text-lg font-bold">核心改善建議</h3>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-emerald-900 font-medium leading-relaxed">
                {batchSummary.opportunity}
              </div>
            </div>
          </div>
        </div>
      </section>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">個別工單詳細拆解</h3>
            </div>
            {!isSharedView && (
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                <input 
                  type="checkbox" 
                  id="select-all-bottom"
                  className="rounded border-slate-300 text-morandi-yellow-600 focus:ring-morandi-yellow-500"
                  checked={selectedTicketIds.size === individualReports.length && individualReports.length > 0}
                  onChange={toggleSelectAll}
                />
                <label htmlFor="select-all-bottom" className="text-[10px] font-bold text-slate-500 cursor-pointer">全選分享至簡報</label>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {individualReports
              .filter(report => !isSharedView || selectedTicketIds.has(report.ticketId))
              .map((report) => (
              <div 
                key={report.ticketId}
                className={cn(
                  "bg-white rounded-2xl border transition-all overflow-hidden shadow-sm hover:border-morandi-yellow-300",
                  selectedTicketIds.has(report.ticketId) ? "border-morandi-yellow-200 ring-1 ring-morandi-yellow-100" : "border-slate-200 opacity-75"
                )}
              >
                <div className="flex">
                  {!isSharedView && (
                    <div className="w-12 flex flex-col items-center pt-6 bg-slate-50/50 border-r border-slate-100">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-morandi-yellow-600 focus:ring-morandi-yellow-500 w-5 h-5"
                        checked={selectedTicketIds.has(report.ticketId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(report.ticketId);
                        }}
                      />
                      <div className="mt-2 text-[8px] font-bold text-slate-400 uppercase vertical-text">分享</div>
                    </div>
                  )}
                  <button 
                    onClick={() => toggleExpand(report.ticketId)}
                    className="flex-1 flex items-center justify-between p-6 text-left"
                  >
                    <div className="flex items-center gap-4">
                  <div className="bg-slate-100 p-3 rounded-xl text-slate-600">
                    <Hash size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-lg flex items-center gap-1">
                        Ticket #
                        <a 
                          href={`https://furbo.zendesk.com/agent/tickets/${report.ticketId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {report.ticketId}
                          <ExternalLink size={14} />
                        </a>
                      </h4>
                      <span className="bg-morandi-yellow-50 text-morandi-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold">時長: {report.durationMinutes} 分鐘</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">點擊展開詳細內容分析</p>
                  </div>
                </div>
                  {expandedIds.has(report.ticketId) ? <ChevronUp className="text-slate-300" /> : <ChevronDown className="text-slate-300" />}
                </button>
              </div>

              <AnimatePresence>
                {expandedIds.has(report.ticketId) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-8 pt-2 space-y-8 border-t border-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Summary Points */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <FileText size={16} />
                            <h5 className="text-xs font-bold uppercase tracking-widest">對話重點</h5>
                          </div>
                          <ul className="space-y-3">
                            {report.summaryPoints.map((point, i) => (
                              <li key={i} className="flex gap-3 text-sm text-slate-600">
                                <span className="flex-shrink-0 w-5 h-5 bg-slate-50 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-100 mt-0.5">{i + 1}</span>
                                <textarea 
                                  className="flex-1 bg-transparent hover:bg-slate-50 border-none focus:ring-0 p-0 resize-none overflow-hidden min-h-[1.5em] leading-relaxed"
                                  rows={1}
                                  value={point}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  onChange={(e) => {
                                    const nextPoints = [...report.summaryPoints];
                                    nextPoints[i] = e.target.value;
                                    handleUpdateField(report.ticketId, 'summaryPoints', nextPoints);
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Takeaways */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <TrendingUp size={16} />
                            <h5 className="text-xs font-bold uppercase tracking-widest">效率分析結論</h5>
                          </div>
                          <div className="space-y-4">
                            {report.takeaways.map((t, i) => (
                              <div key={i} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <input 
                                    className="text-xs font-black text-morandi-yellow-600 bg-transparent border-none focus:ring-0 w-full p-0"
                                    value={t.percentage}
                                    onChange={(e) => {
                                      const nextTakeaways = [...report.takeaways];
                                      nextTakeaways[i] = { ...t, percentage: e.target.value };
                                      handleUpdateField(report.ticketId, 'takeaways', nextTakeaways);
                                    }}
                                  />
                                </div>
                                <textarea 
                                  className="text-sm font-medium text-slate-800 mb-2 bg-transparent border-none focus:ring-0 w-full p-0 resize-none overflow-hidden min-h-[40px] leading-relaxed"
                                  rows={1}
                                  value={t.insight}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  onChange={(e) => {
                                    const nextTakeaways = [...report.takeaways];
                                    nextTakeaways[i] = { ...t, insight: e.target.value };
                                    handleUpdateField(report.ticketId, 'takeaways', nextTakeaways);
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      el.style.height = 'auto';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                                <div className="flex items-start gap-2 border-l-2 border-morandi-yellow-200 pl-3">
                                  <span className="text-xs text-morandi-yellow-600 font-bold shrink-0 mt-0.5">建議：</span>
                                  <textarea 
                                    className="text-xs text-morandi-yellow-600 font-bold bg-transparent border-none focus:ring-0 w-full p-0 resize-none overflow-hidden min-h-[20px] leading-relaxed"
                                    rows={1}
                                    value={t.suggestion}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                    }}
                                    onChange={(e) => {
                                      const nextTakeaways = [...report.takeaways];
                                      nextTakeaways[i] = { ...t, suggestion: e.target.value };
                                      handleUpdateField(report.ticketId, 'takeaways', nextTakeaways);
                                    }}
                                    ref={(el) => {
                                      if (el) {
                                        el.style.height = 'auto';
                                        el.style.height = `${el.scrollHeight}px`;
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Detail Opportunity */}
                      <div className="bg-morandi-yellow-50/50 p-6 rounded-2xl border border-morandi-yellow-100 flex items-start gap-4">
                        <AlertCircle className="text-morandi-yellow-600 mt-1 flex-shrink-0" size={20} />
                        <div className="space-y-1">
                          <h6 className="text-xs font-bold text-morandi-yellow-600 uppercase tracking-widest">改善建議</h6>
                          <p className="text-slate-700 font-bold text-sm leading-relaxed">{report.opportunity}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Editing Modal for large text fields */}
      <AnimatePresence>
        {editingCell && (editingCell.field === 'caseDescription' || editingCell.field === 'todoItems') && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCell(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-morandi-yellow-100 flex items-center justify-center text-morandi-yellow-600">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      修改{editingCell.field === 'caseDescription' ? '案件說明' : '待辦事項'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ticket #{editingCell.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingCell(null)} 
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <Check size={24} />
                </button>
              </div>
              <div className="p-8">
                <textarea 
                  autoFocus
                  className="w-full min-h-[400px] p-6 text-slate-700 text-lg border-2 border-slate-100 rounded-2xl focus:border-morandi-yellow-600 focus:ring-4 focus:ring-morandi-yellow-50 resize-none leading-relaxed transition-all outline-none"
                  value={individualReports.find(r => r.ticketId === editingCell.id)?.[editingCell.field] as string || ''}
                  onChange={(e) => handleUpdateField(editingCell.id, editingCell.field, e.target.value)}
                  placeholder={`請輸入${editingCell.field === 'caseDescription' ? '案件說明' : '待辦事項'}內容...`}
                />
              </div>
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingCell(null)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={() => setEditingCell(null)}
                  className="bg-morandi-yellow-600 text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:bg-morandi-yellow-700 transition-all shadow-xl shadow-morandi-yellow-200"
                >
                  儲存並關閉
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
