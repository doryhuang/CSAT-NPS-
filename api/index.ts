import express from "express";

const app = express();
app.use(express.json({ limit: '10mb' }));

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
    message: "這是目前的伺服器配置。請確認 Subdomain 是否只有簡稱。"
  });
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
