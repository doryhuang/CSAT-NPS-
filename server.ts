import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Zendesk Ticket Fetching
  app.get("/api/zendesk/ticket/:id", async (req, res) => {
    const ticketId = req.params.id;
    const subdomain = process.env.ZENDESK_SUBDOMAIN;
    const email = process.env.ZENDESK_EMAIL;
    const token = process.env.ZENDESK_API_TOKEN;

    if (!subdomain || !email || !token) {
      return res.status(500).json({ error: "Zendesk configuration missing on server." });
    }

    const auth = Buffer.from(`${email}/token:${token}`).toString("base64");

    try {
      // Fetch Ticket Details
      const ticketRes = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (!ticketRes.ok) {
        return res.status(ticketRes.status).json({ error: "Failed to fetch ticket from Zendesk." });
      }

      const ticketData = await ticketRes.json();

      // Fetch Ticket Comments (to get the actual feedback/body)
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

  // Vite middleware setup for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
