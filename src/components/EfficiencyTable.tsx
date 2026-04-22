import React from 'react';
import { ZendeskIndividualReport } from '../types';
import { cn } from '../lib/utils';

interface EfficiencyTableProps {
  reports: ZendeskIndividualReport[];
}

export const EfficiencyTable: React.FC<EfficiencyTableProps> = ({ reports }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-28 text-center">Type</th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center">ID</th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center">時長</th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">案件說明</th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">To Do</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {reports.map((report) => (
            <tr key={report.ticketId} className="hover:bg-slate-50/50 transition-colors align-top">
              <td className="p-4 text-center">
                <span className={cn(
                  "px-2 py-1 rounded-[4px] text-[10px] font-black uppercase",
                  report.category === 'Inquiry' ? "bg-blue-100 text-blue-600" :
                  report.category === 'Request' ? "bg-purple-100 text-purple-600" :
                  "bg-orange-100 text-orange-600"
                )}>
                  {report.category || 'Issue'}
                </span>
              </td>
              <td className="p-4 text-center font-mono text-sm font-bold text-slate-400">
                #{report.ticketId}
              </td>
              <td className="p-4 text-center">
                <span className="font-bold text-slate-700">{report.durationMinutes}m</span>
              </td>
              <td className="p-4">
                <p className="text-sm text-slate-600 leading-relaxed max-w-md line-clamp-3">
                  {report.caseDescription}
                </p>
              </td>
              <td className="p-4">
                <p className="text-sm text-morandi-yellow-600 font-bold leading-relaxed max-w-md line-clamp-3">
                  {report.todoItems}
                </p>
              </td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr>
              <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                目前無相符的篩選結果
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
