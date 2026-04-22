import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

const getApiKey = (keyName?: string) => {
  const env = (import.meta as any).env || {};
  const specificKey = keyName ? env[keyName] : null;
  return (specificKey as string) || (env.VITE_GEMINI_API_KEY as string) || (process.env.GEMINI_API_KEY as string) || "";
};

const aiCsat = new GoogleGenAI({ apiKey: getApiKey('VITE_GEMINI_API_KEY_CSAT') });
const aiDuration = new GoogleGenAI({ apiKey: getApiKey('VITE_GEMINI_API_KEY_DURATION') });

/**
 * 具備自動重試機制的 Gemini API 呼叫函式
 */
async function generateContentWithRetry(aiInstance: GoogleGenAI, params: any, maxRetries = 3) {
  let lastError: any;
  let delay = 2000; // 初始等待 2 秒

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await aiInstance.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const isQuotaError = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('REHAUSTED');
      
      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`[AI Quota Hit] 正在進行第 ${i + 1} 次重試，等待 ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 指數級增加等待時間
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function analyzeFeedbackForSlide(feedback: Feedback): Promise<SlideData> {
  const prompt = `
    Analyze the following customer feedback and generate a structured summary for a presentation slide.
    
    Ticket ID: ${feedback.ticketId}
    CSAT Score: ${feedback.csat}
    NPS Score: ${feedback.nps}
    Ticket Comment: ${feedback.ticketComment}
    NPS Comment: ${feedback.npsComment}
    Improvement Suggestion: ${feedback.howToImprove}

    Please provide:
    1. A concise summary of the feedback (工單滿意度評論匯整)。
    2. Key issue points (關鍵問題點)。
    3. Final result/conclusion (最終結論)。
    4. Sentiment (positive, neutral, or negative)。

    Return the result in JSON format.
  `;

  const response = await generateContentWithRetry(aiCsat, {
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyIssues: { type: Type.STRING },
          finalResult: { type: Type.STRING },
          sentiment: { 
            type: Type.STRING,
            enum: ["positive", "neutral", "negative"]
          }
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
}

/**
 * 分析個別 Zendesk 工單內容
 */
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number, category?: string): Promise<ZendeskIndividualReport> {
  // 限制長度避免單次流量過大
  const safeContent = content.slice(0, 8000);
  
  const prompt = `
    你是一位極度嚴謹的資深客服分析師與品質控管專家。
    任務：深度分析 Zendesk 工單對話紀錄。
    
    Ticket ID: ${ticketId}
    ${category ? `工單項目: ${category}` : ''}
    ${safeContent}

    ### 要求：
    1. 案件說明 (caseDescription)
    2. 對話重點 (summaryPoints) - 5點
    3. 待辦改善建議 (todoItems)
    4. 結論洞察 (takeaways) - 3個包含比重
    5. SOP 改善機會 (opportunity)

    請以中文回報。
  `;

  const response = await generateContentWithRetry(aiDuration, {
    model: "gemini-3.1-flash-lite-preview",
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
              },
              required: ["percentage", "insight", "suggestion"]
            }
          },
          opportunity: { type: Type.STRING }
        },
        required: ["durationMinutes", "caseDescription", "todoItems", "summaryPoints", "takeaways", "opportunity"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return { ticketId, category, ...result };
}

/**
 * 批次分析多筆 Zendesk 工單 (節省 API 配額)
 */
export async function batchAnalyzeZendeskTickets(tickets: Feedback[]): Promise<{ 
  individual: ZendeskIndividualReport[]; 
  summary: ZendeskBatchSummary; 
}> {
  // 每個工單內容進行初步節省長度
  const ticketsContent = tickets.map((f, idx) => `
    ### Ticket #${idx + 1}
    ID: ${f.ticketId}
    類別: ${f.category || '未分類'}
    對話內容: ${f.ticketComment.slice(0, 5000)}
    ${f.manualDuration ? `時長: ${f.manualDuration} 分鐘` : ''}
  `).join('\n---\n');

  const prompt = `
    你是一位極度專業的資深客服分析師經理。
    任務：分析以下一批 Zendesk 工單 (${tickets.length}筆)。

    ### 分析準則：
    1. 為每一件工單產出詳盡分析 (individualReports)。
    2. 總結整體服務趨勢 (batchSummary)。

    請以中文回報。
  `;

  const response = await generateContentWithRetry(aiDuration, {
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          individualReports: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                ticketId: { type: Type.STRING },
                durationMinutes: { type: Type.NUMBER },
                caseDescription: { type: Type.STRING },
                summaryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                todoItems: { type: Type.STRING },
                takeaways: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      percentage: { type: Type.STRING },
                      insight: { type: Type.STRING },
                      suggestion: { type: Type.STRING }
                    },
                    required: ["percentage", "insight", "suggestion"]
                  }
                },
                opportunity: { type: Type.STRING }
              },
              required: ["ticketId", "durationMinutes", "caseDescription", "summaryPoints", "todoItems", "takeaways", "opportunity"]
            }
          },
          batchSummary: {
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
                  },
                  required: ["title", "insight", "suggestion"]
                }
              },
              opportunity: { type: Type.STRING }
            },
            required: ["ticketSummary", "takeaways", "opportunity"]
          }
        },
        required: ["individualReports", "batchSummary"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  
  const individualWithMetaData = result.individualReports.map((report: any) => {
    const original = tickets.find(t => t.ticketId === report.ticketId);
    return {
      ...report,
      category: original?.category
    };
  });

  return {
    individual: individualWithMetaData,
    summary: {
      ...result.batchSummary,
      caseIds: individualWithMetaData.map((r: any) => r.ticketId)
    }
  };
}
