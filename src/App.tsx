import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  Sparkles, 
  Layout, 
  AlertCircle,
  Clock,
  ChevronLeft,
  Share2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleSheetImport } from './components/GoogleSheetImport';
import { ZendeskImporter } from './components/ZendeskImporter';
import { SlideGenerator as FeedbackSlide } from './components/SlideGenerator';
import { SummarySlide as FinalSummarySlide } from './components/SummarySlide';
import { EfficiencyTable } from './components/EfficiencyTable';
import { Feedback, SlideData, ZendeskBatchData, ZendeskIndividualReport } from './types';
import { analyzeFeedbackForSlide, analyzeIndividualZendeskTicket, generateZendeskBatchSummary } from './services/gemini';
import { saveReport, getReport } from './services/firebase';
import { cn } from './lib/utils';

function App() {
  const [activeTab, setActiveTab] = useState<'csat' | 'duration'>('csat');
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [zendeskBatchData, setZendeskBatchData] = useState<ZendeskBatchData | null>(null);
  const [selectedBatchTicketIds, setSelectedBatchTicketIds] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Inquiry' | 'Issue' | 'Request'>('All');

  // Handle Shared Report
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report');
    if (reportId) {
      loadSharedReport(reportId);
    }
  }, []);

  const loadSharedReport = async (id: string) => {
    setIsAnalyzing(true);
    try {
      const data = await getReport(id);
      if (data.type === 'csat') {
        setSlides(data.slides);
        setActiveTab('csat');
      } else {
        setZendeskBatchData(data.batchData);
        setSelectedBatchTicketIds(new Set(data.batchData.individual.map((r: any) => r.ticketId)));
        setActiveTab('duration');
      }
    } catch (err) {
      alert("無法載入分享的報告");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = (newFeedbacks: Feedback[]) => {
    setFeedbacks(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const filteredNew = newFeedbacks.filter(f => !existingIds.has(f.id));
      return [...prev, ...filteredNew];
    });
  };

  const handleAddManyZendeskTickets = async (newTickets: Feedback[]) => {
    let combinedFeedbacks = feedbacks;
    if (newTickets.length > 0) {
      const existingIds = new Set(feedbacks.map(f => f.ticketId));
      const filteredNew = newTickets.filter(t => !existingIds.has(t.ticketId));
      combinedFeedbacks = [...feedbacks, ...filteredNew];
      setFeedbacks(combinedFeedbacks);
    }
    
    if (combinedFeedbacks.length > 0) {
      setIsAnalyzing(true);
      try {
        const individualReports: ZendeskIndividualReport[] = [];
        for (const f of combinedFeedbacks) {
          try {
            const report = await analyzeIndividualZendeskTicket(f.ticketId || '', f.ticketComment, f.manualDuration, f.category);
            individualReports.push(report);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (ticketErr: any) {
            throw ticketErr;
          }
        }
        
        const batchSummary = await generateZendeskBatchSummary(individualReports);
        setZendeskBatchData({ individual: individualReports, summary: batchSummary });
        setSelectedBatchTicketIds(new Set(individualReports.map(r => r.ticketId)));
      } catch (err) {
        console.error("Analysis failed", err);
        const errorMsg = err instanceof Error ? err.message : "未知錯誤";
        let displayError = `AI 分析中斷：${errorMsg}`;
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.includes('quota')) {
          displayError = "【AI 額度暫時用完】\n\nGoogle 目前限制了分析速度。請等待約 1 分鐘後，點擊「重新啟動 AI 分析」按鈕即可續傳。";
        }
        alert(displayError);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const reportData = activeTab === 'csat' 
        ? { type: 'csat', slides }
        : { type: 'duration', batchData: zendeskBatchData };
      
      const reportId = await saveReport(reportData);
      const url = `${window.location.origin}${window.location.pathname}?report=${reportId}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      alert("分享連結已複製到剪貼簿！");
    } catch (err) {
      alert("分享失敗，請稍後再試");
    } finally {
      setIsSharing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) return;
    setIsAnalyzing(true);
    try {
      const selectedFeedbacks = feedbacks.filter(f => selectedIds.has(f.id));
      const analyzedSlides = await Promise.all(
        selectedFeedbacks.map(f => analyzeFeedbackForSlide(f))
      );
      setSlides(analyzedSlides);
      setCurrentSlideIndex(0);
    } catch (error) {
      alert("分析失敗，請檢查 API Key 或網路連線");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredIndividualReports = useMemo(() => {
    if (!zendeskBatchData) return [];
    if (categoryFilter === 'All') return zendeskBatchData.individual;
    return zendeskBatchData.individual.filter(r => r.category === categoryFilter);
  }, [zendeskBatchData, categoryFilter]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-morandi-yellow-200">
      <header className="bg-white/80 backdrop-blur-md border-b border-morandi-yellow-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-morandi-yellow-500 p-2 rounded-xl shadow-lg shadow-morandi-yellow-200">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">客服數據洞察 <span className="text-morandi-yellow-500 italic">Pro</span></h1>
          </div>
          
          <nav className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => {
                setActiveTab('csat');
                setSlides([]);
                setZendeskBatchData(null);
                setFeedbacks([]);
              }}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'csat' ? "bg-white text-morandi-yellow-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Layout size={18} />
              CSAT & NPS
            </button>
            <button 
              onClick={() => {
                setActiveTab('duration');
                setSlides([]);
                setZendeskBatchData(null);
                setFeedbacks([]);
              }}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 text-nowrap",
                activeTab === 'duration' ? "bg-white text-morandi-yellow-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Clock size={18} />
              Chat Duration
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
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
          ) : (feedbacks.length > 0 && activeTab === 'duration' && !zendeskBatchData) ? (
            <motion.div 
              key="retry-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto mt-12 p-12 bg-white rounded-[3rem] border-2 border-red-100 shadow-2xl flex flex-col items-center text-center space-y-8"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI 分析暫時中斷</h2>
                <p className="text-slate-500 leading-relaxed">
                  可能是因為 Google API 的免費額度限制導致請求頻率過快。您的資料已安全備妥，請稍候約一分鐘後點擊下方按鈕繼續分析。
                </p>
              </div>
              <div className="flex flex-col w-full gap-4">
                <button 
                  onClick={() => handleAddManyZendeskTickets([])}
                  className="w-full flex items-center justify-center gap-3 py-5 bg-morandi-yellow-600 text-white rounded-2xl font-black text-xl hover:bg-morandi-yellow-700 shadow-xl shadow-morandi-yellow-100 transition-all active:scale-95"
                >
                  <RefreshCw className="w-6 h-6" />
                  重新啟動 AI 分析
                </button>
                <button 
                  onClick={() => setFeedbacks([])}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  放棄並重新輸入工單
                </button>
              </div>
            </motion.div>
          ) : (feedbacks.length === 0) ? (
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
          ) : (activeTab === 'csat' && slides.length === 0) ? (
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
                      onClick={() => setSelectedIds(new Set(feedbacks.map(f => f.id)))}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      選取全部
                    </button>
                    <span className="text-slate-200">/</span>
                    <button 
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      取消選取
                    </button>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-3 px-8 py-4 bg-morandi-yellow-600 text-white rounded-2xl font-black hover:bg-morandi-yellow-700 disabled:opacity-50 disabled:grayscale transition-all shadow-xl shadow-morandi-yellow-100 active:scale-95"
                  >
                    <Sparkles size={20} />
                    開始生成分析簡報
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedbacks.map((feedback) => (
                  <motion.div
                    key={feedback.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => toggleSelect(feedback.id)}
                    className={cn(
                      "group relative p-6 rounded-3xl border-2 transition-all cursor-pointer overflow-hidden",
                      selectedIds.has(feedback.id)
                        ? "bg-white border-morandi-yellow-400 shadow-xl shadow-morandi-yellow-100"
                        : "bg-white/50 border-white hover:border-slate-200 shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                          selectedIds.has(feedback.id) ? "bg-morandi-yellow-500 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {feedback.ticketId.slice(-2)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 tracking-tight">#{feedback.ticketId}</h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">工單編號</span>
                        </div>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedIds.has(feedback.id) ? "bg-morandi-yellow-500 border-morandi-yellow-500" : "border-slate-200"
                      )}>
                        {selectedIds.has(feedback.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CSAT</span>
                          <span className="font-black text-slate-700">{feedback.csat}/5</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NPS</span>
                          <span className="font-black text-slate-700">{feedback.nps}/10</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                        {feedback.ticketComment || "無提供細節評語..."}
                      </p>
                    </div>

                    <div className={cn(
                      "absolute bottom-0 left-0 h-1 transition-all",
                      selectedIds.has(feedback.id) ? "bg-morandi-yellow-500 w-full" : "bg-transparent w-0"
                    )} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : slides.length > 0 ? (
            <motion.div 
              key="slides"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => {
                    setSlides([]);
                    setShareUrl(null);
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors"
                >
                  <ChevronLeft size={20} />
                  重新選取工單
                </button>

                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlideIndex(i)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-black transition-all",
                          currentSlideIndex === i ? "bg-white text-morandi-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentSlideIndex(slides.length)}
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        currentSlideIndex === slides.length ? "bg-white text-morandi-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <BarChart3 size={14} />
                    </button>
                  </div>

                  <button 
                    onClick={handleShare}
                    disabled={isSharing}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50"
                  >
                    <Share2 size={18} />
                    分享報告
                  </button>
                </div>
              </div>

              <div className="relative min-h-[600px]">
                <AnimatePresence mode="wait">
                  {currentSlideIndex < slides.length ? (
                    <FeedbackSlide 
                      key={slides[currentSlideIndex].ticketId} 
                      data={slides[currentSlideIndex]} 
                      onUpdate={(updated) => {
                        const next = [...slides];
                        next[currentSlideIndex] = updated;
                        setSlides(next);
                      }}
                    />
                  ) : (
                    <FinalSummarySlide key="summary" slides={slides} />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : zendeskBatchData ? (
             <motion.div 
                key="zendesk-report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <button 
                    onClick={() => {
                      setZendeskBatchData(null);
                      setShareUrl(null);
                      setFeedbacks([]);
                    }}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors"
                  >
                    <ChevronLeft size={20} />
                    返回匯入頁面
                  </button>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      {(['All', 'Inquiry', 'Issue', 'Request'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                            categoryFilter === cat ? "bg-white text-morandi-yellow-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          {cat === 'All' ? '全部' : cat}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleShare}
                      disabled={isSharing}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50"
                    >
                      <Share2 size={18} />
                      分享報告
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                  <div className="bg-white p-8 rounded-[2rem] border border-morandi-yellow-100 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-morandi-yellow-500 p-2.5 rounded-xl text-white shadow-lg shadow-morandi-yellow-100">
                        <Sparkles size={24} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">總體分析摘要</h3>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-lg mb-8">
                      {zendeskBatchData.summary.ticketSummary}
                    </p>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">核心改善建議</h4>
                      <p className="text-slate-600 leading-relaxed italic">
                        {zendeskBatchData.summary.opportunity}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {zendeskBatchData.summary.takeaways.map((item, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white p-6 rounded-[1.5rem] border border-morandi-yellow-100 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <h4 className="font-black text-slate-800 mb-2">{item.title}</h4>
                        <div className="space-y-2">
                          <p className="text-sm text-slate-600"><span className="font-bold text-morandi-yellow-600">洞察：</span>{item.insight}</p>
                          <p className="text-sm text-slate-600"><span className="font-bold text-morandi-green-600">建議：</span>{item.suggestion}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-morandi-yellow-100 shadow-xl overflow-hidden">
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2.5 rounded-xl text-slate-400">
                        <BarChart3 size={24} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">對話時長與案情明細</h3>
                    </div>
                    <div className="text-sm font-bold text-slate-400">顯示 {filteredIndividualReports.length} 筆資料</div>
                  </div>
                  <EfficiencyTable reports={filteredIndividualReports} />
                </div>
              </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {shareUrl && (
        <div className="fixed bottom-8 right-8 bg-white p-4 rounded-2xl shadow-2xl border border-morandi-yellow-100 flex items-center gap-4 animate-in slide-in-from-bottom-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">報告已分享</span>
            <span className="text-xs text-morandi-yellow-600 font-bold truncate max-w-[200px]">{shareUrl}</span>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              alert("已複製連結");
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
