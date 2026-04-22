import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || (process.env.GEMINI_API_KEY as string) || "" });

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
    1. A concise summary of the feedback (工單滿意度評論).
    2. Key issue points (關鍵問題點).
    3. Final result/conclusion (最終結果).
    4. Sentiment (positive, neutral, or negative).

    Return the result in JSON format.
  `;

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
 * 使用 gemini-3-flash-preview 以兼顧分析速度與配額限制，並保持精準的邏輯要求
 */
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number, category?: string): Promise<ZendeskIndividualReport> {
  const prompt = `
    你是一位極度嚴謹的資深客服分析師與品質控管專家（QA Specialist）。
    任務：深度分析 Zendesk 工單對話紀錄，產出精準、客觀且無誤的報告。
    
    ### 待分析對話記錄：
    Ticket ID: ${ticketId}
    ${category ? `工單項目: ${category}` : ''}
    ${content}

    ### 核心分析準則（嚴格執行）：
    1. **拒絕幻覺 (Zero Fabrication)**：
       - **嚴禁臆測**：僅能根據對話中明確出現的文字進行分析。未提及的資訊（如：背後原因、用戶情緒、未記錄的操作）嚴禁出現在報告中。
       - **精準定義**：如果用戶說「App 打不開」，不准寫成「網路不穩」。

    2. **時長與空窗精準分析**：
       - **空窗時間 (Idle Time)**：定義為「雙方無對話且某方在等待」超過 3 分鐘。
       - **嚴禁誤判**：若對話密集（訊息間隔 < 3 分鐘），即使對話時間長達數十分鐘，也**絕對禁止**稱為空窗。應歸類為「解決過程緩慢」或「問題複雜」。
       - **計算邏輯**：${manualDuration !== undefined ? `已提供外部計算時長 ${manualDuration} 分鐘，請直接使用此數值並分析原因。` : '由「Agent Joined」或第一則客服回覆，至「User Left」或最後一則用戶訊息的時間差。'}

    3. **事實查核 (Fact-Checking)**：
       - 在生成 summaryPoints 與 takeaways 時，請確保每一點都能在對話中找到對應的訊息或時間標記。

    ### 輸出要求：
    1. **案件說明 (caseDescription)**：準確、技術性地描述核心問題。
    2. **對話重點 (summaryPoints)**：提供 5 個精簡且事實基礎的對話里程碑。
    3. **結論洞察 (takeaways)**：提供 3 個基於此案事實的結論。百分比應反映該因素在該對話中的「比重」或「頻率」。
    4. **SOP 改善機會 (opportunity)**：基於對話中暴露出的效率瓶頸，提出一個具體的 SOP 修改建議。

    請以中文回報。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          durationMinutes: { type: Type.NUMBER, description: "總對話時長（分鐘）" },
          caseDescription: { type: Type.STRING, description: "準確且技術性的案件描述" },
          todoItems: { type: Type.STRING, description: "後續改善建議" },
          summaryPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5點事實基礎的對話重點" },
          takeaways: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                percentage: { type: Type.STRING, description: "標題與比重，如 '操作溝通耗時 (60%)'" },
                insight: { type: Type.STRING, description: "基於對話事實的深度洞察" },
                suggestion: { type: Type.STRING, description: "具體的單案優化建議" }
              },
              required: ["percentage", "insight", "suggestion"]
            }
          },
          opportunity: { type: Type.STRING, description: "SOP 改善機會" }
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
 * 將多個案件合併在同一個 Prompt 中處理，僅消耗 1 次 API 額度
 */
export async function batchAnalyzeZendeskTickets(tickets: Feedback[]): Promise<{ 
  individual: ZendeskIndividualReport[]; 
  summary: ZendeskBatchSummary; 
}> {
  const ticketsContent = tickets.map((f, idx) => `
    ### Ticket #${idx + 1}
    ID: ${f.ticketId}
    類別: ${f.category || '未分類'}
    對話內容: ${f.ticketComment}
    ${f.manualDuration ? `時長 (外部提供): ${f.manualDuration} 分鐘` : ''}
  `).join('\n---\n');

  const prompt = `
    你是一位極度專業的資深客服分析師經理。
    任務：分析以下一組 Zendesk 工單，並針對每一筆提供深度分析，最後提供一個整體的批次摘要。

    ### 待分析工單：
    ${ticketsContent}

    ### 分析準則：
    1. **單案分析 (individualReports)**：針對每一件工單，分析其案件說明、對話重點 (5個)、結論洞察 (3個) 及 SOP 改善機會。
    2. **整體摘要 (batchSummary)**：橫跨所有工單，分析整體服務表現趨勢。
    3. **時長計算**：若工單未提供外部時長，請根據對話時間戳記估計。

    請以中文回報。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
              required: ["ticketId", "durationMinutes", "caseDescription", "summaryPoints", "takeaways", "opportunity"]
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
  
  // Ensure ticketId mapping matches original metadata
  const individualWithMetaData = result.individualReports.map((report: any) => {
    const original = tickets.find(t => t.ticketId === report.ticketId);
    return {
      ...report,
      category: original?.category,
      todoItems: "分析後待辦項" // Placeholder for schema compatibility if needed
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
