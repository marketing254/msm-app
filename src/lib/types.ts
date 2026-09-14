export type Vertical = "Medical" | "Dental" | "Med spa" | "Legal";

export type ReportStatus = "draft" | "running" | "waiting" | "ready" | "sent";

export type StepState = "todo" | "running" | "done" | "waiting" | "failed";

export interface Intake {
  name: string;
  company: string;
  cell: string;
  office: string;
  email: string;
  website: string;
  address: string;
  referral: string;
  vertical: Vertical;
  comments: string;
}

export interface CityOption {
  name: string;
  state: string;
  population: number;
  distanceMiles: number;
  home?: boolean;
  selected: boolean;
}

export interface KeywordOption {
  keyword: string;
  selected: boolean;
  source: "website" | "added";
}

export interface Step {
  id: number;
  title: string;
  state: StepState;
  detail: string;
}

export interface LogEntry {
  time: string;
  text: string;
}

export interface Competitor {
  id: string;
  name: string;
  beats: number;
  distanceMiles: number;
  overlapPct: number;
  rating: number;
  reviews: number;
  website: string;
  verified: "verified" | "manual" | "low-overlap";
  selected: boolean;
}

export interface Listing {
  platform: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  url: string | null;
  match: "match" | "mismatch" | "not-listed" | "not-applicable";
  reason?: string;
  source: "api" | "search";
  confirmed: boolean;
}

export interface AiModeRow {
  keyword: string;
  shows: boolean;
  others: string[];
  checked: boolean;
}

export interface Finding {
  level: "attention" | "watch" | "strength";
  text: string;
}

export interface PageSpeedRow {
  page: string;
  url: string;
  device: "Mobile" | "Desktop";
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export interface CopyscapeRow {
  url: string;
  allowedPct: number;
  foundPct: number;
  finding: string;
}

export interface ReviewRow {
  who: string;
  platform: "Google" | "Yelp" | "Facebook";
  rating: number | null;
  reviews: number | null;
  note: string;
}

/** Rank per keyword per selected city: 1..10 = position on page 1, null = not on page 1 */
export type RankGrid = Record<string, (number | null)[]>;

export type NotifyChannel = "Slack" | "Email" | "Slack + Email";

export interface Delivery {
  /** Google Sheet link. Set when the report is approved. Excel stays as a fallback download. */
  sheetUrl?: string;
  driveFolder: string;
  sentTo?: string;
  sentVia?: NotifyChannel;
  sentAt?: string;
  aeApproval: "not-sent" | "pending" | "approved";
  hubspot: "not-connected" | "pending" | "written";
}

export interface Report {
  id: string;
  intake: Intake;
  ae: string;
  notify: NotifyChannel;
  delivery: Delivery;
  status: ReportStatus;
  currentStep: number;
  nextStepLabel: string;
  startedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  wordpress: boolean;
  legacySite?: string;
  services: string[];
  cities: CityOption[];
  keywords: KeywordOption[];
  steps: Step[];
  log: LogEntry[];
  ranks: RankGrid;
  competitors: Competitor[];
  competitorRanks: Record<string, RankGrid>;
  listings: Listing[];
  aiMode: AiModeRow[];
  pageSpeed: PageSpeedRow[];
  copyscape: CopyscapeRow[];
  reviews: ReviewRow[];
  bottomLine: string;
  findings: Finding[];
}
