import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

export async function analyzeFeedbackForSlide(feedback: Feedback): Promise<SlideData> {
  const response = await fetch("/api/analyze/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) throw new Error("Analysis failed");
  const result = await response.json();
  
  return {
    ticketId: feedback.ticketId,
    csat: feedback.csat,
    nps: feedback.nps,
    summary: result.summary,
    keyIssues: result.keyIssues,
    finalResult: result.finalResult,
    sentiment: result.sentiment
  };
}

/**
 * 分析個別 Zendesk 工單內容
 * 現在改為透過後端 API 進行，以確保 Vercel 環境下的穩定性與金鑰安全
 */
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number): Promise<ZendeskIndividualReport> {
  const response = await fetch("/api/analyze/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketId, content, manualDuration })
  });

  if (!response.ok) throw new Error("Ticket analysis failed");
  const result = await response.json();
  return { ticketId, ...result };
}

/**
 * 生成批次報告摘要
 * 透過後端 API 進行分析
 */
export async function generateZendeskBatchSummary(reports: ZendeskIndividualReport[]): Promise<ZendeskBatchSummary> {
  const response = await fetch("/api/analyze/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports })
  });

  if (!response.ok) throw new Error("Batch analysis failed");
  const result = await response.json();
  return { ...result, caseIds: reports.map(r => r.ticketId) };
}
