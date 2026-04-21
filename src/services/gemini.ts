import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData, ZendeskIndividualReport, ZendeskBatchSummary } from "../types";

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
export async function analyzeIndividualZendeskTicket(ticketId: string, content: string, manualDuration?: number): Promise<ZendeskIndividualReport> {
  const prompt = `
    你是一位極度嚴謹的資深客服分析師與品質控管專家（QA Specialist）。
    任務：深度分析 Zendesk 工單對話紀錄，產出精準、客觀且無誤的報告。
    
    ### 待分析對話記錄：
    Ticket ID: ${ticketId}
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
  return { ticketId, ...result };
}

/**
 * 生成批次報告摘要
 * 使用 gemini-3-flash-preview 處理複雜的趨勢分析，以避免配額耗盡錯誤
 */
export async function generateZendeskBatchSummary(reports: ZendeskIndividualReport[]): Promise<ZendeskBatchSummary> {
  const reportsContext = reports.map(r => `
    工單 ID: ${r.ticketId}
    時長: ${r.durationMinutes} 分鐘
    案件說明: ${r.caseDescription}
    分析重點: ${r.summaryPoints.join('; ')}
    結論洞察: ${r.takeaways.map(t => t.insight).join('; ')}
  `).join('\n---\n');

  const prompt = `
    你是一位極度專業的資深客服營運分析經理。
    任務：將多筆 Zendesk 工單的分析結果整合為一份高層級的「效率與品質分析報告」。
    
    ### 原始數據來源：
    ${reportsContext}

    ### 核心分析準則：
    1. **絕對準確**：總結內容必須與各別工單的事實數據完全一致，嚴禁誇大或縮小。
    2. **深度趨勢分析**：識別跨工單的系統性問題，例如：特定產品功能的缺陷、某類問題的 SOP 缺失、或客服效能普遍低下的原因。
    3. **拒絕範本化**：不准提供籠統、通用的建議（如「加強培訓」）。建議必須具體到可以立即執行的操作。

    ### 要求：
    1. **對話效率總體摘要 (ticketSummary)**：一段話精煉總結整體服務效能與發現。
    2. **核心戰略結論 (takeaways)**：提供 3 個基於數據的趨勢結論，需包含具體情境。
    3. **核心改善機會 (opportunity)**：提出一項最高權重的整體 SOP 或流程優化建議。

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
          ticketSummary: { type: Type.STRING, description: "對話效率總體摘要" },
          takeaways: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "結論標題，包含百分比或比重" },
                insight: { type: Type.STRING, description: "深層趨勢洞察與事實根據" },
                suggestion: { type: Type.STRING, description: "針對此趨勢的戰略性優化建議" }
              },
              required: ["title", "insight", "suggestion"]
            }
          },
          opportunity: { type: Type.STRING, description: "核心改善機會" }
        },
        required: ["ticketSummary", "takeaways", "opportunity"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  return { ...result, caseIds: reports.map(r => r.ticketId) };
}
