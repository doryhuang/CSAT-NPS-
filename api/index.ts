import express from "express";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// API Route for Zendesk Ticket Fetching
app.get("/api/zendesk/ticket/:id", async (req, res) => {
  const ticketId = req.params.id;
  // 自動清理 Subdomain，避免使用者填入完整網址
  let subdomain = (process.env.ZENDESK_SUBDOMAIN || "").toLowerCase().trim();
  subdomain = subdomain.replace(/^https?:\/\//, "").replace(/\.zendesk\.com\/?$/, "");
  
  // 自動清理 Email，避免使用者多填了 /token
  let email = (process.env.ZENDESK_EMAIL || "").trim();
  email = email.replace(/\/token$/, "");
  
  const token = (process.env.ZENDESK_API_TOKEN || "").trim();

  if (!subdomain || !email || !token) {
    return res.status(500).json({ 
      error: "Zendesk configuration missing.",
      details: `Values: subdomain=${!!subdomain}, email=${!!email}, token=${!!token}`
    });
  }

  // Zendesk API Token 認證格式必須是 base64(email/token:api_token)
  const auth = Buffer.from(`${email}/token:${token}`).toString("base64");
  const targetUrl = `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`;

  try {
    const ticketRes = await fetch(targetUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!ticketRes.ok) {
      const errorText = await ticketRes.text();
      let parsedError;
      try { parsedError = JSON.parse(errorText); } catch(e) { parsedError = errorText; }
      
      return res.status(ticketRes.status).json({ 
        error: ticketRes.status === 404 ? "找不到此工單 (404)" : "Zendesk API 發生錯誤",
        status: ticketRes.status,
        details: parsedError,
        requestedUrl: targetUrl,
        help: "請確認您的 ZENDESK_SUBDOMAIN 是否正確，且該工單 ID 是否確實存在於該網域中。"
      });
    }

    const ticketData = await ticketRes.json();
    const commentsRes = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}/comments.json`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    const commentsData = await commentsRes.json();
    res.json({
      ticket: ticketData.ticket,
      comments: commentsData.comments,
    });
  } catch (error) {
    console.error("Zendesk API Error:", error);
    res.status(500).json({ error: "Internal server error connecting to Zendesk." });
  }
});

// 新增驗證路由，協助診斷環境變數
app.get("/api/zendesk/debug-config", (req, res) => {
  const subdomain = process.env.ZENDESK_SUBDOMAIN || "未設定";
  const email = process.env.ZENDESK_EMAIL || "未設定";
  const hasToken = !!process.env.ZENDESK_API_TOKEN;
  
  res.json({
    subdomain,
    email,
    hasToken,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    message: "這是目前的伺服器配置。請確認 Subdomain 是否只有簡稱。"
  });
});

// AI 分析路由
app.post("/api/analyze/feedback", async (req, res) => {
  const { feedback } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

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
    const result = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
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
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: "Analysis failed", details: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/analyze/ticket", async (req, res) => {
  const { ticketId, content, manualDuration, category } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

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
    - summaryPoints: 繁體中文字串陣列
    - takeaways: 包含 percentage, insight, suggestion 的陣列
    - opportunity: 繁體中文核心改善建議
  `;

  try {
    const result = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
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
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Ticket Analysis Error:", error);
    res.status(500).json({ error: "Ticket analysis failed", details: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/analyze/batch", async (req, res) => {
  const { reports } = req.body;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

  const reportsContext = reports.map((r: any) => `ID: ${r.ticketId}, 類別: ${r.category}, 時長: ${r.durationMinutes}, 案情: ${r.caseDescription}`).join('\n---\n');
  const prompt = `
    請將多筆 Zendesk 工單的分析結果整合為一份總結報告。
    【重要指令：必須使用繁體中文（台灣格式）生成所有回答內容】
    原始資料內容：
    ${reportsContext}
    請提供 ticketSummary, takeaways, opportunity。
    Return JSON.
  `;

  try {
    const result = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
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
    res.json(JSON.parse(result.response.text()));
  } catch (error) {
    console.error("Batch Analysis Error:", error);
    res.status(500).json({ error: "Batch analysis failed", details: error instanceof Error ? error.message : String(error) });
  }
});

// For local development with Vite
if (process.env.VITE_DEV === 'true' && process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// 關鍵：在 Vercel 環境下不需要 app.listen，只需要匯出 app
export default app;
