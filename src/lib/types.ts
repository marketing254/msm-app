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

/** A job handed to the browser worker: rank checks (with listings) or competitor reviews. */
export interface RankJob {
  id: string;
  reportId: string;
  kind: "rank" | "competitors";
  /** kind = rank: also read the client's listings and reviews on the 6 platforms */
  listings?: { name: string; address: string; phone: string; city: string; state: string; vertical: Vertical };
  /** kind = competitors: read Google rating and review count for these */
  competitorNames?: { id: string; name: string; domain: string; city: string; state: string }[];
  status: "pending" | "running" | "captcha" | "done" | "failed";
  message: string;
  createdAt: number;
  updatedAt: number;
  clientName: string;
  clientDomain: string;
  keywords: string[];
  cities: { name: string; state: string }[];
  /** keywords to read in AI Mode; shorter in test mode */
  aiKeywords?: string[];
  testMode?: boolean;
  result?: RankJobResult;
}

export interface SearchResult { position: number; domain: string; title: string; url: string }

export interface RankJobResult {
  /** one entry per keyword x city, in the order given */
  searches: { keyword: string; city: string; results: SearchResult[]; clientPosition: number | null }[];
  /** AI Mode page text per keyword (home city) */
  aiMode: { keyword: string; text: string }[];
  /** page text per listing platform, plus the first matching link where one was found */
  listings?: { platform: string; url: string; text: string }[];
  /** Google page text per competitor */
  competitors?: { id: string; url: string; text: string }[];
  startedAt: string;
  finishedAt: string;
  machine: string;
}

export interface Competitor {
  id: string;
  name: string;
  /** false when only the domain and positions are known (from the rank worker) */
  dataKnown?: boolean;
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
  /** not-checked = no source was available to read this platform */
  match: "match" | "mismatch" | "not-listed" | "not-applicable" | "not-checked";
  reason?: string;
  /** api = official API, worker = read from the platform page by the browser worker, search = found by a web search */
  source: "api" | "worker" | "search";
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

/** Rank per keyword per selected city: 1..10 = position on page 1, null = not on page 1, undefined = not searched */
export type RankGrid = Record<string, (number | null | undefined)[]>;

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

/** Where a step's numbers came from. Shown on the progress page so testers know what is real. */
export type Provenance = "live" | "sample" | "not run";

export interface Report {
  id: string;
  intake: Intake;
  ae: string;
  provenance: Partial<Record<number, Provenance>>;
  sitePages: string[];
  lastError?: string;
  jobId?: string;
  competitorJobId?: string;
  /** rating and review count read per platform in step 6, used by step 7 */
  platformRatings?: Record<string, { rating: number | null; reviews: number | null }>;
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
