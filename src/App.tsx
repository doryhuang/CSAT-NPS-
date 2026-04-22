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
  CheckCircle2,
  Database,
  Search,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from './types';
import { GoogleSheetImport } from './components/GoogleSheetImport';
import { ZendeskImporter } from './components/ZendeskImporter';
import { FeedbackTable } from './components/FeedbackTable';
import { SlideGenerator } from './components/SlideGenerator';
import { ZendeskBatchReportView } from './components/ZendeskBatchReportView';
import { analyzeFeedbackForSlide, analyzeIndividualZendeskTicket, generateZendeskBatchSummary } from './services/gemini';
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
  const [selectedBatchTicketIds, setSelectedBatchTicketIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [importMode, setImportMode] = useState<'sheet' | 'zendesk'>('sheet');
  const [activeTab, setActiveTab] = useState<'csat' | 'duration'>('csat');
  
  const [zendeskBatchData, setZendeskBatchData] = useState<{
    individual: ZendeskIndividualReport[];
    summary: ZendeskBatchSummary;
  } | null>(null);

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
            if (data) {
              if (Array.isArray(data.slides) && data.slides.length > 0) {
                setSlides(data.slides);
                setActiveTab('csat');
                setFeedbacks([{ id: 'placeholder', ticketId: 'Shared', csat: 0, nps: 0, ticketComment: '', npsComment: '', howToImprove: '' }]);
              } else if (data.batchData) {
                setZendeskBatchData(data.batchData);
                if (data.selectedTicketIds) {
                  setSelectedBatchTicketIds(new Set(data.selectedTicketIds));
                } else if (data.batchData.individual) {
                  setSelectedBatchTicketIds(new Set(data.batchData.individual.map((r: any) => r.ticketId)));
                }
                setActiveTab('duration');
                setFeedbacks([{ id: 'placeholder', ticketId: 'Shared', csat: 0, nps: 0, ticketComment: '', npsComment: '', howToImprove: '' }]);
              }
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
    if (slides.length === 0 && !zendeskBatchData) return;
    setIsSharing(true);
    try {
      const shareData: any = {
        createdAt: serverTimestamp(),
        tab: activeTab
      };
      
      if (activeTab === 'csat') {
        shareData.slides = slides;
      } else if (zendeskBatchData) {
        shareData.batchData = zendeskBatchData;
        shareData.selectedTicketIds = Array.from(selectedBatchTicketIds);
      }

      const docRef = await addDoc(collection(db, 'shared_slides'), shareData);
      
      const url = new URL(window.location.href);
      url.searchParams.set('id', docRef.id);
      
      await navigator.clipboard.writeText(url.toString());
      setToast({ message: '分享連結已複製到剪貼簿！', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      setTimeout(() => setIsSharing(false), 2000);
    } catch (e) {
      console.error("Failed to share", e);
      setToast({ message: '分享失敗，請稍後再試', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      setIsSharing(false);
    }
  };

  const handleImport = (data: Feedback[]) => {
    setFeedbacks(data);
    setSelectedIds(new Set());
    setSlides([]);
    setZendeskBatchData(null);
  };

  const handleAddManyZendeskTickets = async (newFeedbacks: Feedback[]) => {
    // Add to existing list
    setFeedbacks(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const filteredNew = newFeedbacks.filter(f => !existingIds.has(f.id));
      return [...prev, ...filteredNew];
    });
    
    // Auto-analyze immediately if in duration tab
    if (activeTab === 'duration') {
      setIsAnalyzing(true);
      try {
        const individualReports = await Promise.all(
          newFeedbacks.map(f => analyzeIndividualZendeskTicket(f.ticketId || '', f.ticketComment, f.manualDuration, f.category))
        );
        const batchSummary = await generateZendeskBatchSummary(individualReports);
        setZendeskBatchData({ individual: individualReports, summary: batchSummary });
        setSelectedBatchTicketIds(new Set(individualReports.map(r => r.ticketId)));
      } catch (err) {
        console.error("Analysis failed", err);
        setFeedbacks([]); // If analysis fails, go back to import page
        alert("分析失敗，請檢查 API Key 或網路連線。");
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      // For CSAT, still just select them
      setSelectedIds(prev => {
        const next = new Set(prev);
        newFeedbacks.forEach(f => next.add(f.id));
        return next;
      });
    }
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
    
    try {
      const selectedFeedbacks = feedbacks.filter(f => selectedIds.has(f.id));
      
      if (activeTab === 'csat') {
        setSlides([]);
        setZendeskBatchData(null);
        const results = await Promise.all(
          selectedFeedbacks.map(f => analyzeFeedbackForSlide(f))
        );
        setSlides(results);
        setActiveSlideIndex(0);
      } else {
        setSlides([]);
        setZendeskBatchData(null);
        // Step 1: Analyze each ticket
        const individualReports = await Promise.all(
          selectedFeedbacks.map(f => analyzeIndividualZendeskTicket(f.ticketId || '', f.ticketComment, f.manualDuration))
        );
        // Step 2: Batch summary
        const summary = await generateZendeskBatchSummary(individualReports);
        setZendeskBatchData({ individual: individualReports, summary });
      }
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

  const updateBatchData = (reports: ZendeskIndividualReport[], summary: ZendeskBatchSummary) => {
    setZendeskBatchData({ individual: reports, summary });
  };

  return (
    <div className="min-h-screen bg-morandi-yellow-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-morandi-yellow-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-morandi-yellow-500 p-2 rounded-xl shadow-lg shadow-morandi-yellow-100">
              <Presentation className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">InsightFlow <span className="text-slate-400 font-normal">| {activeTab === 'csat' ? 'CSAT & NPS 分析' : 'Chat Duration 分析'}</span></h1>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => {
                setActiveTab('csat');
                setFeedbacks([]);
                setSlides([]);
                setZendeskBatchData(null);
                setSelectedIds(new Set());
              }}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'csat' ? "bg-white text-morandi-yellow-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              CSAT/NPS
            </button>
            <button
              onClick={() => {
                setActiveTab('duration');
                setFeedbacks([]);
                setSlides([]);
                setZendeskBatchData(null);
                setSelectedIds(new Set());
                setImportMode('zendesk'); // Default to zendesk for duration
              }}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                activeTab === 'duration' ? "bg-white text-morandi-yellow-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Chat Duration
            </button>
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
          {(feedbacks.length === 0 || (activeTab === 'duration' && !zendeskBatchData && !isAnalyzing)) ? (
            <motion.div 
              key="import"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto mt-12"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-morandi-yellow-900 sm:text-4xl tracking-tight">
                  {activeTab === 'csat' ? '從數據中提取深度洞察' : '分析對話超時核心原因'}
                </h2>
                <p className="mt-4 text-lg text-morandi-yellow-600">
                  {activeTab === 'csat' 
                    ? '匯入您的客戶回饋，勾選感興趣的項目，讓 AI 為您製作專業的分析簡報。'
                    : '匯入 Zendesk 工單，AI 將為您找出對話超時的主要癥結並提供優化建議。'}
                </p>
              </div>

              {activeTab === 'csat' ? (
                <GoogleSheetImport onImport={handleImport} />
              ) : (
                <ZendeskImporter onImportMany={handleAddManyZendeskTickets} />
              )}
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 space-y-8"
            >
              <div className="relative w-32 h-32">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-morandi-yellow-500"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-morandi-yellow-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-800">AI 正在深度分析中</h3>
                <p className="text-slate-500 font-medium italic">我們正在根據工單內容與對話時長提取關鍵洞察...</p>
              </div>
            </motion.div>
          ) : (activeTab === 'csat' && feedbacks.length > 0 && slides.length === 0) ? (
            <motion.div 
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-3xl border border-morandi-yellow-100 shadow-sm gap-6">
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

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setFeedbacks([]); 
                        setZendeskBatchData(null);
                        setSlides([]);
                      }}
                      className="flex items-center gap-2 px-4 py-3 bg-white border border-morandi-yellow-200 text-morandi-yellow-600 rounded-xl font-bold hover:bg-morandi-yellow-50 transition-all text-sm"
                    >
                      <Plus size={16} />
                      繼續加入
                    </button>
                    <button 
                      onClick={handleAnalyze}
                      disabled={selectedIds.size === 0 || isAnalyzing}
                      className="flex items-center gap-2 px-8 py-3 bg-morandi-yellow-600 text-white rounded-xl font-bold hover:bg-morandi-yellow-700 disabled:opacity-50 transition-all shadow-lg shadow-morandi-yellow-100 text-sm"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isAnalyzing ? 'AI 分析中...' : '開始 AI 分析'}
                    </button>
                  </div>
                </div>
              </div>

              <FeedbackTable 
                data={feedbacks} 
                selectedIds={selectedIds} 
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                mode="csat-nps"
              />
            </motion.div>
          ) : zendeskBatchData ? (
            <motion.div
              key="zendesk-report"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => {
                    setZendeskBatchData(null);
                    if (activeTab === 'duration') {
                      setFeedbacks([]); // Clear feedbacks to go back to importer
                    }
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
                >
                  <ArrowLeft size={18} />
                  {activeTab === 'duration' ? '返回匯入' : '返回列表'}
                </button>
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
                    onClick={() => setZendeskBatchData(null)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <ZendeskBatchReportView 
                batchSummary={zendeskBatchData.summary}
                individualReports={zendeskBatchData.individual}
                selectedTicketIds={selectedBatchTicketIds}
                isSharedView={new URLSearchParams(window.location.search).has('id')}
                onToggleSelect={(id) => {
                  const next = new Set(selectedBatchTicketIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setSelectedBatchTicketIds(next);
                }}
                onToggleSelectAll={() => {
                  if (selectedBatchTicketIds.size === zendeskBatchData.individual.length) {
                    setSelectedBatchTicketIds(new Set());
                  } else {
                    setSelectedBatchTicketIds(new Set(zendeskBatchData.individual.map(r => r.ticketId)));
                  }
                }}
                onUpdateReports={(updatedReports) => {
                  setZendeskBatchData({
                    ...zendeskBatchData,
                    individual: updatedReports
                  });
                }}
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
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm z-[100] flex items-center gap-3",
              toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
