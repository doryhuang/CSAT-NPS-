import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

// 初始化 Google GenAI
const getApiKey = () => {
  // 優先嘗試從 process.env 獲取 (AI Studio 注入或後端環境)
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  // 其次嘗試 Vite 專用的環境變數 (Vercel 前端設定 VITE_GEMINI_API_KEY)
  const metaEnv = (import.meta as any).env;
  if (metaEnv?.VITE_GEMINI_API_KEY) {
    return metaEnv.VITE_GEMINI_API_KEY;
  }
  return "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export async function analyzeFeedbackForSlide(feedback: Feedback): Promise<SlideData> {
  const prompt = `
    請分析以下客戶回饋，並為簡報頁面生成結構化的摘要。
    【重要指令：必須使用繁體中文（台灣格式）回答所有欄位內容】
    工單 ID: ${feedback.ticketId}
    CSAT 分數: ${feedback.csat}
    NPS 分數: ${feedback.nps}
    工單評論: ${feedback.ticketComment}
    NPS 評論: ${feedback.npsComment}
    改善建議: ${feedback.howToImprove}
    請提供 summary, keyIssues, finalResult, sentiment。
    請以 JSON 格式回傳。
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
            summary: { type: Type.STRING, description: "繁體中文摘要" },
            keyIssues: { type: Type.STRING, description: "繁體中文關鍵問題" },
            finalResult: { type: Type.STRING, description: "繁體中文最終結果" },
            sentiment: { type: Type.STRING, description: "情緒分析（正向/中立/負向）" }
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
    【重要指令：所有輸出的內容（summary, description, todo, insights, suggestion）必須完全使用繁體中文（台灣格式）】
    
    工單 ID: ${ticketId}
    類別: ${category || 'N/A'}
    對話內容: ${content}
    時長資訊: ${manualDuration !== undefined ? `外部計算為 ${manualDuration} 分鐘` : '分析對話時長'}
    
    請提供以下欄位（JSON 格式）：
    - durationMinutes: 數字
    - caseDescription: 繁體中文案件說明
    - todoItems: 繁體中文待辦事項
    - summaryPoints: 繁體中文字串陣列（對話重點）
    - takeaways: 包含 percentage, insight(繁體中文), suggestion(繁體中文) 的陣列
    - opportunity: 繁體中文核心改善建議
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
  const reportsContext = reports.map((r: any) => `ID: ${r.ticketId}, 類別: ${r.category}, 時長: ${r.durationMinutes}, 案情: ${r.caseDescription}`).join('\n---\n');
  const prompt = `
    請將多筆 Zendesk 工單的分析結果整合為一份總結報告。
    【重要指令：必須使用繁體中文（台灣格式）生成所有回答內容】
    
    原始資料內容：
    ${reportsContext}
    
    請提供以下欄位（JSON 格式）：
    - ticketSummary: 繁體中文總體效率摘要
    - takeaways: 包含 title(繁體中文), insight(繁體中文), suggestion(繁體中文) 的陣列
    - opportunity: 繁體中文核心改善建議
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
