import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

// 初始化 Google GenAI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeFeedbackForSlide(feedback: Feedback): Promise<SlideData> {
  const prompt = `
    Analyze the following customer feedback and generate a structured summary for a presentation slide.
    Ticket ID: ${feedback.ticketId}
    CSAT Score: ${feedback.csat}
    NPS Score: ${feedback.nps}
    Ticket Comment: ${feedback.ticketComment}
    NPS Comment: ${feedback.npsComment}
    Improvement Suggestion: ${feedback.howToImprove}
    Please provide summary, keyIssues, finalResult, sentiment.
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyIssues: { type: Type.STRING },
            finalResult: { type: Type.STRING },
            sentiment: { type: Type.STRING }
          },
          required: ["summary", "keyIssues", "finalResult", "sentiment"]
        }
      }
    });
    
    const result = JSON.parse(response.text || "{}");
    
    return {
      ticketId: feedback.ticketId,
      csat: feedback.csat,
      nps: feedback.nps,
      summary: result.summary,
      keyIssues: result.keyIssues,
      finalResult: result.finalResult,
      sentiment: result.sentiment
    };
  } catch (error) {
    console.error("Gemini Analysis failed:", error);
    throw new Error("Analysis failed");
  }
}

/**
 * 分析個別 Zendesk 工單內容
 */
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number, category?: string): Promise<ZendeskIndividualReport> {
  const prompt = `
    你是一位極度嚴謹的資深客服分析師與品質控管專家（QA Specialist）。
    任務：深度分析 Zendesk 工單對話紀錄，產出精準、客觀且無誤的報告。
    Ticket ID: ${ticketId}
    Category: ${category || 'N/A'}
    ${content}
    計算邏輯：${manualDuration !== undefined ? `已提供外部計算時長 ${manualDuration} 分鐘` : '分析對話時長'}
    請提供 durationMinutes, caseDescription, todoItems, summaryPoints, takeaways, opportunity.
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            durationMinutes: { type: Type.NUMBER },
            caseDescription: { type: Type.STRING },
            todoItems: { type: Type.STRING },
            summaryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            takeaways: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  percentage: { type: Type.STRING },
                  insight: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                }
              }
            },
            opportunity: { type: Type.STRING }
          },
          required: ["durationMinutes", "caseDescription", "todoItems", "summaryPoints", "takeaways", "opportunity"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return { ticketId, category: category as any, ...result };
  } catch (error) {
    console.error("Gemini Ticket analysis failed:", error);
    throw new Error("Ticket analysis failed");
  }
}

/**
 * 生成批次報告摘要
 */
export async function generateZendeskBatchSummary(reports: ZendeskIndividualReport[]): Promise<ZendeskBatchSummary> {
  const reportsContext = reports.map((r: any) => `ID: ${r.ticketId}, Category: ${r.category}, Duration: ${r.durationMinutes}, Desc: ${r.caseDescription}`).join('\n---\n');
  const prompt = `
    將多筆 Zendesk 工單的分析結果整合。
    ${reportsContext}
    提供 ticketSummary, takeaways, opportunity.
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ticketSummary: { type: Type.STRING },
            takeaways: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  insight: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                }
              }
            },
            opportunity: { type: Type.STRING }
          },
          required: ["ticketSummary", "takeaways", "opportunity"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return { ...result, caseIds: reports.map(r => r.ticketId) };
  } catch (error) {
    console.error("Gemini Batch analysis failed:", error);
    throw new Error("Batch analysis failed");
  }
}
