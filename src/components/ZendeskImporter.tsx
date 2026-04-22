import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, Ticket, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Feedback } from '../types';
import { cn } from '../lib/utils';

interface ZendeskImporterProps {
  onImportMany: (feedbacks: Feedback[]) => void;
}

export const ZendeskImporter: React.FC<ZendeskImporterProps> = ({ onImportMany }) => {
  const [ticketIdsInput, setTicketIdsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = ticketIdsInput.split('\n').filter(line => line.trim() !== '');
    
    let currentCategory: string | undefined = undefined;
    const ticketData: { id: string; duration: number | null; category?: string }[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Extract parts
      const parts = trimmed.split(/[\s\t]+/).filter(p => p.trim() !== '');
      
      // Look for category keywords
      const categoryMatch = trimmed.match(/\b(Inquiry|Issue|Issues|Request)\b/i);
      if (categoryMatch) {
        // Normalize "Issues" to "Issue" or keep as is? User said "Issue / request" but image says "Issues".
        // I'll keep the direct string but maybe normalize common ones.
        let cat = categoryMatch[1];
        // Minimal normalization
        if (cat.toLowerCase() === 'issues') cat = 'Issue';
        // Capitalize first letter
        cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        currentCategory = cat;
      }

      // Look for potential Ticket ID (usually 7 digits)
      const idMatch = trimmed.match(/\b(\d{7})\b/);
      if (idMatch) {
        const id = idMatch[1];
        
        // Find duration in the same line
        // Look for something like "14.3" or "17"
        // Try to find the number that isn't the ID
        const numbers = parts
          .map(p => p.replace(/[^\d.]/g, ''))
          .filter(p => p !== '' && p !== id && !isNaN(parseFloat(p)));
        
        const duration = numbers.length > 0 ? Math.round(parseFloat(numbers[0])) : null;
        
        ticketData.push({
          id,
          duration,
          category: currentCategory
        });
      }
    });

    if (ticketData.length === 0) return;

    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: ticketData.length });

    const fetchedFeedbacks: Feedback[] = [];
    const errors: string[] = [];

    for (let i = 0; i < ticketData.length; i++) {
      const { id, duration, category } = ticketData[i];
      setProgress(prev => ({ ...prev, current: i + 1 }));
      try {
        const response = await fetch(`/api/zendesk/ticket/${id}`);
        if (!response.ok) {
          errors.push(`ID ${id}: ${response.status === 404 ? '找不到此工單' : '擷取失敗'}`);
          continue;
        }

        const data = await response.json();
        const ticket = data.ticket;
        const allComments = (data.comments || [])
          .map((c: any) => `[${c.created_at}] ${c.author_id === ticket.requester_id ? 'User' : 'Agent'}: ${c.body}`)
          .join('\n\n');
        
        fetchedFeedbacks.push({
          id: `zd-${ticket.id}`,
          ticketId: ticket.id.toString(),
          csat: ticket.satisfaction_rating?.score === 'good' ? 5 : 0, 
          nps: 0, 
          ticketComment: allComments || ticket.description || '',
          npsComment: '',
          howToImprove: '',
          manualDuration: duration ?? undefined,
          category: category
        });
      } catch (err) {
        errors.push(`ID ${id}: 發生連線錯誤`);
      }
    }

    if (fetchedFeedbacks.length > 0) {
      onImportMany(fetchedFeedbacks);
      setTicketIdsInput('');
    }

    if (errors.length > 0) {
      setError(`部分擷取失敗: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
    } else {
      setError(null);
    }
    setIsLoading(false);
  };

  const parsedCount = ticketIdsInput.split('\n').filter(l => l.trim().split(/[\s\t]+/)[0]).length;

  return (
    <div className="bg-white p-8 rounded-2xl border border-morandi-yellow-100 shadow-xl max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-morandi-yellow-100 p-2.5 rounded-xl">
            <Ticket className="w-6 h-6 text-morandi-yellow-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">直接擷取 Zendesk 工單</h3>
            <p className="text-sm text-slate-500">輸入 ID 與時長（可直接從列表貼入）</p>
          </div>
        </div>
        {parsedCount > 0 && (
          <div className="bg-morandi-yellow-50 px-3 py-1 rounded-full border border-morandi-yellow-100">
            <span className="text-xs font-bold text-morandi-yellow-600">偵測到 {parsedCount} 筆</span>
          </div>
        )}
      </div>

      <form onSubmit={handleFetch} className="space-y-4">
        <div className="relative">
          <textarea
            value={ticketIdsInput}
            onChange={(e) => setTicketIdsInput(e.target.value)}
            placeholder="2280429 9.11&#10;2283455 17.95"
            rows={5}
            className="w-full pl-4 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-morandi-yellow-400 focus:bg-white rounded-2xl outline-none transition-all text-sm font-mono resize-none"
          />
        </div>

        {isLoading && (
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              className="bg-morandi-yellow-500 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !ticketIdsInput.trim()}
          className="w-full py-4 bg-morandi-yellow-600 text-white rounded-2xl font-bold hover:bg-morandi-yellow-700 disabled:opacity-50 transition-all shadow-lg shadow-morandi-yellow-100 flex items-center justify-center gap-2 text-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              正在擷取 ({progress.current}/{progress.total})...
            </>
          ) : (
            <>
              <Plus className="w-6 h-6" />
              擷取並加入列表
            </>
          )}
        </button>
      </form>
    </div>
  );
};
