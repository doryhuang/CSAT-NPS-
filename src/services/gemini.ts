import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

export async function analyzeFeedbackForSlide(feedback: Feedback): Promise<SlideData> {
  const response = await fetch("/api/analyze/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Analysis failed");
  }
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
 */
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number, category?: string): Promise<ZendeskIndividualReport> {
  const response = await fetch("/api/analyze/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketId, content, manualDuration, category })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Ticket analysis failed");
  }
  const result = await response.json();
  return { ticketId, category: category as any, ...result };
}

/**
 * 生成批次報告摘要
 */
export async function generateZendeskBatchSummary(reports: ZendeskIndividualReport[]): Promise<ZendeskBatchSummary> {
  const response = await fetch("/api/analyze/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Batch analysis failed");
  }
  const result = await response.json();
  return { ...result, caseIds: reports.map(r => r.ticketId) };
}
