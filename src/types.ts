export interface Feedback {
  id: string;
  ticketId: string;
  csat: number;
  nps: number;
  ticketComment: string;
  npsComment: string;
  howToImprove: string;
  manualDuration?: number;
  category?: 'Inquiry' | 'Issue' | 'Request';
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

export interface ZendeskIndividualReport {
  ticketId: string;
  category?: 'Inquiry' | 'Issue' | 'Request';
  durationMinutes: number;
  summaryPoints: string[];
  caseDescription: string;
  todoItems: string;
  takeaways: {
    percentage: string;
    insight: string;
    suggestion: string;
  }[];
  opportunity: string;
}

export interface ZendeskBatchSummary {
  ticketSummary: string;
  takeaways: {
    title: string;
    insight: string;
    suggestion: string;
  }[];
  opportunity: string;
  caseIds: string[];
}

export interface ZendeskBatchData {
  individual: ZendeskIndividualReport[];
  summary: ZendeskBatchSummary;
}
