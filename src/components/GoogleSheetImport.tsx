import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Link2, AlertCircle, FileText } from 'lucide-react';
import { Feedback } from '../types';
import Papa from 'papaparse';

interface GoogleSheetImportProps {
  onImport: (data: Feedback[]) => void;
}

export const GoogleSheetImport: React.FC<GoogleSheetImportProps> = ({ onImport }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!sheetUrl) return;
    setIsLoading(true);
    setError(null);
    
    try {
      let url = sheetUrl;
      // Convert Google Sheet URL to CSV export URL if applicable
      if (url.includes('docs.google.com/spreadsheets')) {
        const match = url.match(/\/d\/(.+?)(\/|$)/);
        const gidMatch = url.match(/gid=(\d+)/);
        if (match) {
          url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
          if (gidMatch) {
            url += `&gid=${gidMatch[1]}`;
          }
        }
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('無法讀取連結，請確保該試算表已開啟「知道連結的人皆可查看」。');
      
      const text = await response.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data: Feedback[] = results.data.map((row: any, index: number) => {
            // Find keys case-insensitively and with spaces/underscores
            const findValue = (keys: string[]) => {
              const rowKeys = Object.keys(row);
              // 1. Exact match (after normalization)
              let foundKey = rowKeys.find(rk => 
                keys.some(k => rk.toLowerCase().replace(/[\s_]/g, '') === k.toLowerCase().replace(/[\s_]/g, ''))
              );
              
              // 2. Substring match if exact match fails
              if (!foundKey) {
                foundKey = rowKeys.find(rk => 
                  keys.some(k => rk.toLowerCase().includes(k.toLowerCase()))
                );
              }
              
              return foundKey ? row[foundKey] : '';
            };

            return {
              id: String(index + 1),
              ticketId: findValue(['ticket id', 'id', 'ticketid', '工單ID', '工單 ID', '工單編號', 'TicketID']),
              csat: parseInt(findValue(['csat', 'csat score', '滿意度', '工單滿意度', '評分', 'CSATScore'])) || 0,
              nps: parseInt(findValue(['nps', 'nps score', 'nps分數', 'nps 分數', 'nps評分', 'NPSScore'])) || 0,
              ticketComment: findValue(['ticket comment', 'comment', '工單評論', '工單 評論', '工單評論內容', '用戶回饋內容', '回饋內容', 'TicketComment', '評論']),
              npsComment: findValue(['nps comment', 'nps評論', 'nps 評論', 'nps評論內容', 'nps回饋', 'NPSComment', 'NPS評論']),
              howToImprove: findValue(['how to improve', 'improvement', '改進建議', '如何改進', '建議', '優化建議', 'Howtoimprove', '改進']),
            };
          }).filter(f => f.ticketId); // Ensure we have a ticket ID

          if (data.length === 0) {
            setError('找不到有效數據，請檢查欄位名稱是否包含 Ticket ID, CSAT, NPS 等。');
          } else {
            onImport(data);
          }
          setIsLoading(false);
        },
        error: (err) => {
          setError('解析 CSV 失敗：' + err.message);
          setIsLoading(false);
        }
      });

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '匯入失敗');
      
      // Fallback to mock data for demo if it fails
      if (sheetUrl === 'demo') {
        const mockData: Feedback[] = Array.from({ length: 142 }, (_, i) => ({
          id: String(i + 1),
          ticketId: String(2249585 + i),
          csat: Math.floor(Math.random() * 5) + 1,
          nps: Math.floor(Math.random() * 11),
          ticketComment: `這是第 ${i + 1} 筆工單的原始評論內容。`,
          npsComment: `這是第 ${i + 1} 筆 NPS 的原始評論內容。`,
          howToImprove: `這是第 ${i + 1} 筆的改進建議。`,
        }));
        onImport(mockData);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-morandi-yellow-200 hover:border-morandi-yellow-400 transition-all group">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-4 bg-morandi-yellow-50 rounded-full group-hover:scale-110 transition-transform">
          <FileSpreadsheet className="w-10 h-10 text-morandi-yellow-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">匯入 Google Sheet 數據</h3>
          <p className="text-sm text-slate-500 mt-1">請貼上您的 Google Sheet 連結（需開啟共用權限）</p>
        </div>
        
        <div className="w-full max-w-md space-y-3 mt-4">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="貼上您的 Google Sheet 連結"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-morandi-yellow-500 transition-all"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-xs text-rose-600">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <button 
            onClick={handleImport}
            disabled={!sheetUrl || isLoading}
            className="w-full py-2.5 bg-morandi-yellow-600 text-white rounded-xl font-bold hover:bg-morandi-yellow-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-morandi-yellow-100"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            {isLoading ? '正在匯入...' : '開始匯入'}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 bg-slate-100 rounded-lg">
              <FileText size={16} className="text-slate-500" />
            </div>
            <span className="text-[10px] font-bold text-slate-400">CSV 支援</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="text-left">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">欄位要求</p>
            <p className="text-[10px] text-slate-500">需包含: Ticket ID, CSAT, NPS, Comment</p>
          </div>
        </div>
      </div>
    </div>
  );
};
