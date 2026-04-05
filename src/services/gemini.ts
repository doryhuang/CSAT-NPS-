import { GoogleGenAI, Type } from "@google/genai";
import { Feedback, SlideData } from "../types";

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
       - positive: Satisfied/Very Satisfied
       - neutral: Average/Needs Improvement
       - negative: Complaint/Dissatisfied

    Return the result in JSON format.
    IMPORTANT: For "summary" (工單滿意度評論), please prioritize using the original customer feedback content. If multiple fields (Ticket Comment, NPS Comment, Improvement) are provided, combine them into a coherent paragraph that reflects the user's actual words as much as possible.
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
