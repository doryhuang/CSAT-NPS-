import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// API Route for Zendesk Ticket Fetching
app.get("/api/zendesk/ticket/:id", async (req, res) => {
  const ticketId = req.params.id;
  let subdomain = (process.env.ZENDESK_SUBDOMAIN || "").trim();
  const email = (process.env.ZENDESK_EMAIL || "").trim();
  const token = (process.env.ZENDESK_API_TOKEN || "").trim();

  // Clean subdomain if user pasted the whole URL by mistake
  if (subdomain.includes(".zendesk.com")) {
    subdomain = subdomain.split(".zendesk.com")[0].split("//").pop() || subdomain;
  }

  if (!subdomain || !email || !token) {
    const missing = [];
    if (!subdomain) missing.push("subdomain");
    if (!email) missing.push("email");
    if (!token) missing.push("token");
    
    console.error("Zendesk configuration missing:", { subdomain: !!subdomain, email: !!email, token: !!token });
    return res.status(500).json({ 
      error: "Zendesk configuration missing on server.",
      details: `Missing: ${missing.join(', ')}`
    });
  }

  const auth = Buffer.from(`${email}/token:${token}`).toString("base64");

  try {
    const zendeskUrl = `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`;
    console.log(`Fetching Zendesk ticket: ${zendeskUrl}`);

    // Fetch Ticket Details
    const ticketRes = await fetch(zendeskUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      }
    });

    if (!ticketRes.ok) {
      const errorText = await ticketRes.text();
      console.error(`Zendesk API returned ${ticketRes.status} for ticket ${ticketId}. Body: ${errorText}`);
      return res.status(ticketRes.status).json({ 
        error: "Failed to fetch ticket from Zendesk.",
        status: ticketRes.status,
        details: errorText.slice(0, 200)
      });
    }

    const ticketData = await ticketRes.json();

    // Fetch Ticket Comments
    const commentsUrl = `https://${subdomain}.zendesk.com/api/v2/tickets/${ticketId}/comments.json`;
    const commentsRes = await fetch(commentsUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      }
    });

    if (!commentsRes.ok) {
      console.error(`Zendesk Comments API returned ${commentsRes.status} for ticket ${ticketId}`);
    }

    const commentsData = await commentsRes.json();

    res.json({
      ticket: ticketData.ticket,
      comments: commentsData.comments,
    });
  } catch (error: any) {
    console.error("Zendesk API Error:", error);
    res.status(500).json({ 
      error: "Internal server error connecting to Zendesk.",
      message: error.message
    });
  }
});

export { app };
export default app;
