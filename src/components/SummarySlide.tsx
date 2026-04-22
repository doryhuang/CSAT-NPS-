import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download, Smile, Meh, Frown, Presentation } from 'lucide-react';
import { SlideData } from '../types';

interface SummarySlideProps {
  slides?: SlideData[];
}

export const SummarySlide: React.FC<SummarySlideProps> = ({ slides }) => {
  const slideRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (slideRef.current === null) return;
    const dataUrl = await toPng(slideRef.current, { cacheBust: true });
    const link = document.createElement('a');
    link.download = `summary-slide.png`;
    link.href = dataUrl;
    link.click();
  };

  const states = [
    {
      label: 'Satisfied',
      color: '#4CAF7A',
      icon: <Smile size={48} className="text-white" />,
      hex: '#4CAF7A',
      description: '滿意 / 非常滿意'
    },
    {
      label: 'Neutral',
      color: '#B7A980',
      icon: <Meh size={48} className="text-white" />,
      hex: '#B7A980',
      description: '普通 / 還可以再改進'
    },
    {
      label: 'Dissatisfied',
      color: '#D96C5F',
      icon: <Frown size={48} className="text-white" />,
      hex: '#D96C5F',
      description: '不滿意 / 客訴'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={handleDownload}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
        >
          <Download size={16} />
          下載圖例
        </button>
      </div>

      <div 
        ref={slideRef}
        className="w-full max-w-2xl aspect-[4/3] bg-[#EBCD5C] p-12 flex flex-col items-center justify-center gap-12 relative overflow-hidden"
      >
        {/* Background Decorative Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 bg-black/5 rounded-full blur-3xl" />

        <div className="text-center space-y-2 relative">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Sentiment Analysis Guide</h2>
          <p className="text-slate-700 font-medium opacity-60 uppercase tracking-widest text-xs">Customer Feedback Classification</p>
        </div>

        <div className="grid grid-cols-3 gap-6 w-full relative">
          {states.map((state) => (
            <div key={state.label} className="flex flex-col items-center gap-4">
              <div 
                className="w-full aspect-square rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl border border-white/20 transition-transform hover:scale-105"
                style={{ backgroundColor: state.color }}
              >
                {state.icon}
                <div className="mt-4 text-center">
                  <span className="block text-white font-black text-xl tracking-tight">{state.label}</span>
                  <span className="block text-white/60 font-mono text-[10px] mt-1">{state.hex}</span>
                </div>
              </div>
              <p className="text-slate-800 font-bold text-sm text-center">{state.description}</p>
            </div>
          ))}
        </div>

        {/* Brand/Footer */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center px-12">
          <div className="flex items-center gap-2 opacity-30">
            <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center">
              <Presentation size={12} className="text-white" />
            </div>
            <span className="text-[10px] font-black tracking-tighter uppercase">InsightFlow Analysis System</span>
          </div>
        </div>
      </div>
    </div>
  );
};
