import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { SlideData } from '../types';
import { cn } from '../lib/utils';
import { Download, Edit3, Check, X, Smile, Meh, Frown } from 'lucide-react';

interface SlideGeneratorProps {
  data: SlideData;
  onUpdate: (updated: SlideData) => void;
}

export const SlideGenerator: React.FC<SlideGeneratorProps> = ({ data, onUpdate }) => {
  const slideRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState(data);

  const handleDownload = async () => {
    if (slideRef.current === null) return;
    const dataUrl = await toPng(slideRef.current, { cacheBust: true });
    const link = document.createElement('a');
    link.download = `slide-${data.ticketId}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleSave = () => {
    onUpdate(editValues);
    setIsEditing(false);
  };

  const SentimentIcon = () => {
    switch (data.sentiment) {
      case 'positive': 
        return (
          <div className="relative w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg border-4 border-[#4CAF7A]/20">
            <Smile size={32} className="text-[#4CAF7A]" strokeWidth={2.5} />
          </div>
        );
      case 'neutral': 
        return (
          <div className="relative w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg border-4 border-[#B7A980]/20">
            <Meh size={32} className="text-[#B7A980]" strokeWidth={2.5} />
          </div>
        );
      case 'negative': 
        return (
          <div className="relative w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-lg border-4 border-[#D96C5F]/20">
            <Frown size={32} className="text-[#D96C5F]" strokeWidth={2.5} />
          </div>
        );
    }
  };

  const headerColor = data.sentiment === 'positive' ? 'bg-[#4CAF7A]' : 
                     data.sentiment === 'neutral' ? 'bg-[#B7A980]' : 'bg-[#D96C5F]';
  
  const borderColor = data.sentiment === 'positive' ? 'border-[#4CAF7A]' : 
                     data.sentiment === 'neutral' ? 'border-[#B7A980]' : 'border-[#D96C5F]';

  const bulletColor = data.sentiment === 'positive' ? 'bg-[#4CAF7A]' : 
                     data.sentiment === 'neutral' ? 'bg-[#B7A980]' : 'bg-[#D96C5F]';

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          {isEditing ? <X size={16} /> : <Edit3 size={16} />}
          {isEditing ? '取消' : '修改文字'}
        </button>
        {isEditing && (
          <button 
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-morandi-yellow-600 text-white hover:bg-morandi-yellow-700 rounded-lg transition-colors"
          >
            <Check size={16} />
            儲存
          </button>
        )}
        <button 
          onClick={handleDownload}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors"
        >
          <Download size={16} />
          下載圖片
        </button>
      </div>

      <div 
        ref={slideRef}
        className={cn("w-full max-w-2xl aspect-[4/3] bg-white p-8 border-2 shadow-2xl rounded-2xl flex flex-col gap-8", borderColor)}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-6 p-5 rounded-2xl text-white shadow-lg", headerColor)}>
          <SentimentIcon />
          <div className="flex-1">
            <h3 className="text-3xl font-bold tracking-tight drop-shadow-sm">
              <a 
                href={`https://furbo.zendesk.com/agent/tickets/${data.ticketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline decoration-2 underline-offset-4"
              >
                {data.ticketId}
              </a> : CSAT {data.csat} / NPS {data.nps}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-8 px-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", bulletColor)}>
                <Check size={12} strokeWidth={4} />
              </div>
              <span className="text-lg font-bold text-slate-800">工單滿意度評論：</span>
            </div>
            {isEditing ? (
                <textarea 
                  value={editValues.summary}
                  onChange={(e) => setEditValues({ ...editValues, summary: e.target.value })}
                  className="w-full p-3 text-base border-2 rounded-xl focus:ring-2 focus:ring-morandi-yellow-500 outline-none"
                  rows={3}
                />
            ) : (
              <p className="text-slate-600 text-lg leading-relaxed pl-8">
                {data.summary}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", bulletColor)}>
                <Check size={12} strokeWidth={4} />
              </div>
              <span className="text-lg font-bold text-slate-800">關鍵問題點：</span>
            </div>
            {isEditing ? (
                <textarea 
                  value={editValues.keyIssues}
                  onChange={(e) => setEditValues({ ...editValues, keyIssues: e.target.value })}
                  className="w-full p-3 text-base border-2 rounded-xl focus:ring-2 focus:ring-morandi-yellow-500 outline-none"
                  rows={3}
                />
            ) : (
              <p className="text-slate-600 text-lg leading-relaxed pl-8">
                {data.keyIssues}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", bulletColor)}>
                <Check size={12} strokeWidth={4} />
              </div>
              <span className="text-lg font-bold text-slate-800">最終結果：</span>
            </div>
            {isEditing ? (
                <textarea 
                  value={editValues.finalResult}
                  onChange={(e) => setEditValues({ ...editValues, finalResult: e.target.value })}
                  className="w-full p-3 text-base border-2 rounded-xl focus:ring-2 focus:ring-morandi-yellow-500 outline-none"
                  rows={3}
                />
            ) : (
              <p className="text-slate-600 text-lg leading-relaxed pl-8">
                {data.finalResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
