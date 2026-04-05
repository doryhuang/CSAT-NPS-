import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  LayoutDashboard, 
  MessageSquare, 
  Sparkles, 
  ChevronRight,
  RefreshCw,
  X,
  FileText,
  Presentation,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { Feedback, SlideData } from './types';
import { GoogleSheetImport } from './components/GoogleSheetImport';
import { FeedbackTable } from './components/FeedbackTable';
import { SlideGenerator } from './components/SlideGenerator';
import { analyzeFeedbackForSlide } from './services/gemini';
import { cn } from './lib/utils';
import { useEffect } from 'react';
import { db } from './lib/firebase';
import { 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

export default function App() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('id');
    if (sharedId) {
      const loadSharedData = async () => {
        try {
          const docRef = doc(db, 'shared_slides', sharedId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.slides)) {
              setSlides(data.slides);
              setFeedbacks([{ id: 'placeholder', ticketId: 'Shared', csat: 0, nps: 0, ticketComment: '', npsComment: '', howToImprove: '' }]);
            }
          }
        } catch (e) {
          console.error("Failed to load shared data", e);
        }
      };
      loadSharedData();
    }
  }, []);

  const handleShare = async () => {
    if (slides.length === 0) return;
    setIsSharing(true);
    try {
      const docRef = await addDoc(collection(db, 'shared_slides'), {
        slides: slides,
        createdAt: serverTimestamp()
      });
      
      const url = new URL(window.location.href);
      url.searchParams.set('id', docRef.id);
      
      await navigator.clipboard.writeText(url.toString());
      setTimeout(() => setIsSharing(false), 2000);
    } catch (e) {
      console.error("Failed to share", e);
      setIsSharing(false);
      alert("分享失敗，請稍後再試。");
    }
  };

  const handleImport = (data: Feedback[]) => {
    setFeedbacks(data);
    setSelectedIds(new Set());
    setSlides([]);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === feedbacks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(feedbacks.map(f => f.id)));
    }
  };

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) return;
    setIsAnalyzing(true);
    setSlides([]);
    
    try {
      const selectedFeedbacks = feedbacks.filter(f => selectedIds.has(f.id));
      const results = await Promise.all(
        selectedFeedbacks.map(f => analyzeFeedbackForSlide(f))
      );
      setSlides(results);
      setActiveSlideIndex(0);
    } catch (err) {
      console.error("Analysis failed:", err);
      alert("分析失敗，請檢查 API Key 或網路連線。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateSlide = (updated: SlideData) => {
    const next = [...slides];
    next[activeSlideIndex] = updated;
    setSlides(next);
  };

  return (
    <div className="min-h-screen bg-morandi-yellow-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-morandi-yellow-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-morandi-yellow-500 p-2 rounded-xl shadow-lg shadow-morandi-yellow-100">
              <Presentation className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">InsightFlow <span className="text-slate-400 font-normal">| CSAT & NPS 分析</span></h1>
          </div>
          
          {feedbacks.length > 0 && (
            <button 
              onClick={() => {
                setFeedbacks([]);
                setSlides([]);
                setSelectedIds(new Set());
              }}
              className="text-xs text-slate-400 hover:text-morandi-yellow-600 underline font-medium"
            >
              重新匯入
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {feedbacks.length === 0 ? (
            <motion.div 
              key="import"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto mt-12"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-morandi-yellow-900 sm:text-4xl tracking-tight">
                  從數據中提取深度洞察
                </h2>
                <p className="mt-4 text-lg text-morandi-yellow-600">
                  匯入您的客戶回饋，勾選感興趣的項目，讓 AI 為您製作專業的分析簡報。
                </p>
              </div>
              <GoogleSheetImport onImport={handleImport} />
            </motion.div>
          ) : slides.length === 0 ? (
            <motion.div 
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-morandi-yellow-100 shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">總匯入筆數</span>
                    <span className="text-2xl font-black text-slate-900">{feedbacks.length} <span className="text-sm font-normal text-slate-400">筆</span></span>
                  </div>
                  <div className="w-px h-10 bg-slate-100" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-morandi-yellow-400 uppercase tracking-widest">已選取分析</span>
                    <span className="text-2xl font-black text-morandi-yellow-600">{selectedIds.size} <span className="text-sm font-normal text-morandi-yellow-400">筆</span></span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleAnalyze}
                    disabled={selectedIds.size === 0 || isAnalyzing}
                    className="flex items-center gap-2 px-8 py-3 bg-morandi-yellow-600 text-white rounded-xl font-bold hover:bg-morandi-yellow-700 disabled:opacity-50 transition-all shadow-lg shadow-morandi-yellow-100"
                  >
                    {isAnalyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {isAnalyzing ? 'AI 分析中...' : '開始 AI 分析'}
                  </button>
                </div>
              </div>

              <FeedbackTable 
                data={feedbacks} 
                selectedIds={selectedIds} 
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="slides"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              {/* Sidebar: Slide List */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">分析簡報列表</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleShare}
                      className={cn(
                        "p-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-bold",
                        isSharing 
                          ? "bg-emerald-100 text-emerald-600" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                      title="分享分析結果連結"
                    >
                      {isSharing ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
                      {isSharing ? '已複製' : '分享'}
                    </button>
                    <button 
                      onClick={() => {
                        setSlides([]);
                        // Clear URL params if clearing slides
                        const url = new URL(window.location.href);
                        url.searchParams.delete('id');
                        window.history.replaceState({}, '', url.toString());
                      }}
                      className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  {slides.map((slide, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group",
                        activeSlideIndex === idx 
                          ? "bg-morandi-yellow-600 border-morandi-yellow-600 text-white shadow-lg shadow-morandi-yellow-100" 
                          : "bg-white border-slate-200 hover:border-morandi-yellow-300"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          activeSlideIndex === idx ? "bg-white/20" : "bg-slate-100"
                        )}>
                          <FileText size={16} />
                        </div>
                        <span className="text-sm font-bold">#{slide.ticketId}</span>
                      </div>
                      <ChevronRight size={16} className={cn(
                        "transition-transform",
                        activeSlideIndex === idx ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      )} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Main: Slide Preview */}
              <div className="lg:col-span-3">
                <SlideGenerator 
                  data={slides[activeSlideIndex]} 
                  onUpdate={updateSlide}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
