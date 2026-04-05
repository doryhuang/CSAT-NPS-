export interface Feedback {
  id: string;
  ticketId: string;
  csat: number;
  nps: number;
  ticketComment: string;
  npsComment: string;
  howToImprove: string;
}

export interface SlideData {
  ticketId: string;
  csat: number;
  nps: number;
  summary: string;
  keyIssues: string;
  finalResult: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}
