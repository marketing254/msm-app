import type {
  AiModeRow, CityOption, Competitor, CopyscapeRow, Delivery, Finding, Intake, KeywordOption, Listing,
  NotifyChannel, PageSpeedRow, RankGrid, Report, ReportStatus, ReviewRow, Step, Vertical,
} from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random so sample data is stable between loads  */
/* ------------------------------------------------------------------ */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rnd(seed: string): number { return (hash(seed) % 10000) / 10000; }

export const STEP_TITLES = [
  "Website research and WordPress check",
  "Cities and keywords",
  "30 local rank checks",
  "PageSpeed (2 pages, mobile + desktop)",
  "Copyscape (3 pages)",
  "Listings on 6 platforms",
  "Reviews and ratings",
  "Competitor shortlist",
  "Competitor rankings and reviews",
  "Google AI Mode check",
  "Fill data template and findings summary",
  "Generate Google Sheet (new format)",
];

/** Steps that pause for Dulmini. Key = step id, value = checkpoint number. */
export const CHECKPOINTS: Record<number, 1 | 2 | 3> = { 2: 1, 8: 2, 10: 3 };

export const PLATFORMS = ["Google", "Bing", "Yelp", "Facebook", "Yellow Pages", "Zocdoc"] as const;

export const VERTICAL_WORD: Record<Vertical, string> = {
  Medical: "patient", Dental: "patient", "Med spa": "client", Legal: "client",
};

/* ------------------------------------------------------------------ */
/* Seeds                                                                */
/* ------------------------------------------------------------------ */
export const DRIVE_FOLDER = "Shared drives / Sales / MSM Reports";

interface Seed {
  id: string;
  intake: Intake;
  ae?: string;
  notify?: NotifyChannel;
  status: ReportStatus;
  currentStep: number;
  startedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  wordpress: boolean;
  legacySite?: string;
  services: string[];
  cities: Omit<CityOption, "selected">[];
  keywords: string[];
  extraKeywords: string[];
  competitors: Omit<Competitor, "selected" | "id">[];
  /** "all-poor" = nothing on page 1 (Ever & Ever). "mixed" = generated. */
  rankProfile: "all-poor" | "mixed" | "strong";
  bottomLine: string;
  findings: Finding[];
  reviews: { rating: number | null; reviews: number | null; yelp: [number | null, number | null]; facebook: [number | null, number | null] };
  copyscapeHit?: { url: string; pct: number; finding: string };
  notListed?: string[];
  aiOthers: Record<string, string[]>;
}

const everAndEver: Seed = {
  id: "1042",
  intake: {
    name: "Debbie Muhammad", company: "Ever & Ever Vitality Studio", cell: "(704) 340-7370", office: "(980) 372-3837",
    email: "evereverstudio@gmail.com", website: "https://everandeverstudio.com/", address: "9852 Rea Road, Ste 107, Charlotte, NC 28277",
    referral: "Referral", vertical: "Med spa", comments: "",
  },
  status: "waiting", currentStep: 8, startedAt: "2026-09-03T13:05:00",
  wordpress: true, legacySite: "https://ever-and-ever-vitality-studio.squarespace.com/",
  services: ["Wrinkle Relaxers (Botox/Dysport)", "Skin Health (chemical peels, microneedling)", "Facial Balancing (dermal fillers)", "AquaFirmeXS 4-in-1 Facial", "DE|RIVE Hair Support (hair restoration)", "AlumierMD Medical-Grade Skincare"],
  cities: [
    { name: "Charlotte", state: "NC", population: 945000, distanceMiles: 0, home: true },
    { name: "Concord", state: "NC", population: 105329, distanceMiles: 18 },
    { name: "Huntersville", state: "NC", population: 68535, distanceMiles: 14 },
    { name: "Gastonia", state: "NC", population: 80411, distanceMiles: 22 },
    { name: "Rock Hill", state: "SC", population: 74372, distanceMiles: 24 },
  ],
  keywords: ["Med Spa", "Botox", "Dermal Fillers", "Chemical Peel", "Microneedling", "Laser Hair Removal", "PRP Facial", "Facial Balancing", "Hair Restoration", "Weight Loss Injections"],
  extraKeywords: ["Kybella", "Sculptra"],
  competitors: [
    { name: "M2 Medical Spa and Wellness", beats: 18, distanceMiles: 1.2, overlapPct: 80, rating: 4.8, reviews: 226, website: "m2medspa.com", verified: "verified" },
    { name: "VociMedSpa", beats: 15, distanceMiles: 1.6, overlapPct: 70, rating: 4.7, reviews: 423, website: "vocimedspa.com", verified: "verified" },
    { name: "VIO Med Spa | Rea Farms", beats: 11, distanceMiles: 0.8, overlapPct: 60, rating: 4.9, reviews: 113, website: "viomedspa.com/rea-farms", verified: "verified" },
    { name: "dermani MEDSPA Ballantyne", beats: 9, distanceMiles: 4.1, overlapPct: 60, rating: 4.9, reviews: 81, website: "dermanimedspa.com", verified: "verified" },
    { name: "Infinity MedSpa and Wellness", beats: 21, distanceMiles: 6.5, overlapPct: 50, rating: 4.6, reviews: 312, website: "", verified: "manual" },
    { name: "Carolina Facial Plastics", beats: 14, distanceMiles: 7.0, overlapPct: 30, rating: 4.9, reviews: 540, website: "carolinafacialplastics.com", verified: "low-overlap" },
  ],
  rankProfile: "all-poor",
  bottomLine: "Zero page-1 visibility, anywhere, for anything.",
  findings: [
    { level: "attention", text: "Zero page-1 visibility, anywhere, for anything. The practice does not appear on page 1 for any of the 10 services in any of the 3 cities." },
    { level: "attention", text: "A legacy website is still live and indexed. The old Squarespace site competes with the current one for the practice name." },
    { level: "watch", text: "Reviews live on one platform only. An excellent 5.0-star Google rating, nothing on Yelp or Facebook." },
    { level: "watch", text: "A manufacturer's stock copy is duplicated content. The AquaFirmeXS product page is 26% matched to the manufacturer's site." },
    { level: "strength", text: "Listings are otherwise clean. Name, address and phone match across Google, Bing, Yelp, Facebook and Zocdoc." },
  ],
  reviews: { rating: 5.0, reviews: 42, yelp: [null, 0], facebook: [null, 0] },
  copyscapeHit: { url: "https://everandeverstudio.com/products/", pct: 26, finding: "The AquaFirmeXS product description is verbatim manufacturer copy." },
  notListed: ["Yellow Pages"],
  aiOthers: {
    "Med Spa": ["Infinity MedSpa and Wellness", "Miramae Medical Skin Care Studio", "Ageless Remedies SouthPark"],
    "Botox": ["Carolina Facial Plastics", "Infinity MedSpa and Wellness", "Capizzi MD"],
    "Dermal Fillers": ["Carolina Facial Plastics", "Infinity MedSpa and Wellness", "704 Aesthetics"],
    "Chemical Peel": ["Darst Dermatology", "Charlotte Skin and Laser", "dermani MEDSPA Ballantyne"],
    "Microneedling": ["Infinity MedSpa and Wellness", "Skin Pharm", "Ageless Remedies SouthPark"],
    "Laser Hair Removal": ["Charlotte Skin and Laser", "Ageless Remedies SouthPark", "Milan Laser Hair Removal"],
    "PRP Facial": ["Infinity MedSpa and Wellness", "Carolina Facial Plastics", "The Modern Aesthetic"],
    "Facial Balancing": ["The Modern Aesthetic", "Carolina Facial Plastics", "Lifted Aesthetics Charlotte"],
    "Hair Restoration": ["Maxim Hair Restoration & Transplants", "Cooley Hair Center", "RESTORE Hair"],
    "Weight Loss Injections": ["MED.ish Laser Spa and WeightLoss", "Pivotal Weight Loss & Longevity", "Optimal Wellness"],
  },
};

const brightSmile: Seed = {
  id: "1041",
  intake: {
    name: "Dr. Anita Rao", company: "Bright Smile Family Dental", cell: "(919) 555-0142", office: "(919) 555-0100",
    email: "office@brightsmileraleigh.com", website: "https://brightsmileraleigh.com/", address: "4212 Six Forks Rd, Raleigh, NC 27609",
    referral: "Webinar", vertical: "Dental", comments: "Two doctors, one location.",
  },
  status: "running", currentStep: 7, startedAt: "2026-09-03T12:40:00",
  wordpress: true,
  services: ["General Dentistry", "Dental Implants", "Invisalign", "Cosmetic Dentistry", "Emergency Dentistry"],
  cities: [
    { name: "Raleigh", state: "NC", population: 482295, distanceMiles: 0, home: true },
    { name: "Durham", state: "NC", population: 296186, distanceMiles: 20 },
    { name: "Cary", state: "NC", population: 180010, distanceMiles: 12 },
    { name: "Chapel Hill", state: "NC", population: 62000, distanceMiles: 26 },
  ],
  keywords: ["Dentist", "Dental Implants", "Invisalign", "Teeth Whitening", "Dental Crowns", "Emergency Dentist", "Veneers", "Root Canal", "Pediatric Dentist", "Dental Cleaning"],
  extraKeywords: ["Dentures", "Sedation Dentistry"],
  competitors: [
    { name: "Six Forks Dental Care", beats: 19, distanceMiles: 1.4, overlapPct: 90, rating: 4.9, reviews: 812, website: "sixforksdental.com", verified: "verified" },
    { name: "Raleigh Family Dentistry", beats: 16, distanceMiles: 3.2, overlapPct: 80, rating: 4.8, reviews: 655, website: "raleighfamilydentistry.com", verified: "verified" },
    { name: "North Hills Smiles", beats: 12, distanceMiles: 2.1, overlapPct: 70, rating: 4.7, reviews: 388, website: "northhillssmiles.com", verified: "verified" },
    { name: "Lane & Associates", beats: 10, distanceMiles: 5.5, overlapPct: 60, rating: 4.6, reviews: 1204, website: "", verified: "manual" },
    { name: "Triangle Oral Surgery", beats: 8, distanceMiles: 6.0, overlapPct: 30, rating: 4.9, reviews: 501, website: "triangleoralsurgery.com", verified: "low-overlap" },
  ],
  rankProfile: "mixed",
  bottomLine: "Visible at home, invisible one city over.",
  findings: [
    { level: "attention", text: "Only 4 of 30 keyword/city slots reach the top 3. Durham and Cary show almost no page-1 presence." },
    { level: "watch", text: "Mobile home page performance is 48. Slow pages lose patients before they call." },
    { level: "watch", text: "Yelp phone number does not match the on-file record." },
    { level: "strength", text: "Strong review profile: 4.8 stars on Google with 310 reviews." },
  ],
  reviews: { rating: 4.8, reviews: 310, yelp: [4.2, 26], facebook: [4.9, 44] },
  notListed: [],
  aiOthers: {},
};

const harbor: Seed = {
  id: "1040",
  intake: {
    name: "Marcus Bell", company: "Harbor Paralegal Services", cell: "(813) 555-0177", office: "(813) 555-0170",
    email: "marcus@harborparalegal.com", website: "https://harborparalegal.com/", address: "601 N Ashley Dr, Tampa, FL 33602",
    referral: "Google search", vertical: "Legal", comments: "",
  },
  status: "waiting", currentStep: 2, startedAt: "2026-09-03T11:20:00",
  wordpress: false,
  services: ["Document Preparation", "Family Law Support", "Immigration Forms", "Business Filings", "Notary"],
  cities: [
    { name: "Tampa", state: "FL", population: 403364, distanceMiles: 0, home: true },
    { name: "St. Petersburg", state: "FL", population: 263553, distanceMiles: 19 },
    { name: "Brandon", state: "FL", population: 114626, distanceMiles: 11 },
    { name: "Clearwater", state: "FL", population: 117292, distanceMiles: 22 },
  ],
  keywords: ["Paralegal Services", "Document Preparation", "Divorce Paperwork", "Immigration Forms Help", "LLC Formation", "Notary Services", "Legal Document Assistant", "Small Claims Help", "Name Change Paperwork", "Power of Attorney"],
  extraKeywords: ["Eviction Paperwork", "Will Preparation"],
  competitors: [
    { name: "Bay Area Legal Docs", beats: 14, distanceMiles: 2.0, overlapPct: 80, rating: 4.7, reviews: 96, website: "bayarealegaldocs.com", verified: "verified" },
    { name: "Tampa Document Center", beats: 11, distanceMiles: 4.4, overlapPct: 70, rating: 4.5, reviews: 58, website: "tampadoccenter.com", verified: "verified" },
    { name: "QuickFile Paralegal", beats: 9, distanceMiles: 8.1, overlapPct: 60, rating: 4.8, reviews: 143, website: "", verified: "manual" },
  ],
  rankProfile: "mixed",
  bottomLine: "Ranks for the brand, not for the services.",
  findings: [
    { level: "attention", text: "No page-1 presence for any document-preparation keyword outside Tampa." },
    { level: "watch", text: "Site is not on WordPress; content changes need a developer." },
    { level: "strength", text: "Google listing is complete and matches the on-file record." },
  ],
  reviews: { rating: 4.6, reviews: 71, yelp: [4.0, 9], facebook: [null, 0] },
  notListed: ["Yellow Pages"],
  aiOthers: {},
};

const lakeside: Seed = {
  id: "1039",
  intake: {
    name: "Dr. Priya Nair", company: "Lakeside Pediatrics", cell: "(512) 555-0131", office: "(512) 555-0120",
    email: "hello@lakesidepeds.com", website: "https://lakesidepeds.com/", address: "2500 Bee Cave Rd, Austin, TX 78746",
    referral: "Referral", vertical: "Medical", comments: "",
  },
  status: "ready", currentStep: 12, startedAt: "2026-09-02T15:10:00",
  wordpress: true,
  services: ["Well-Child Visits", "Newborn Care", "Vaccinations", "Sick Visits", "Sports Physicals"],
  cities: [
    { name: "Austin", state: "TX", population: 979882, distanceMiles: 0, home: true },
    { name: "Round Rock", state: "TX", population: 133372, distanceMiles: 19 },
    { name: "Cedar Park", state: "TX", population: 77595, distanceMiles: 17 },
    { name: "Georgetown", state: "TX", population: 75420, distanceMiles: 27 },
  ],
  keywords: ["Pediatrician", "Pediatric Clinic", "Newborn Doctor", "Child Vaccinations", "Sports Physical", "Well Child Checkup", "Sick Child Visit", "Pediatric Urgent Care", "Kids Doctor", "Same Day Pediatrician"],
  extraKeywords: ["Adolescent Medicine"],
  competitors: [
    { name: "Austin Regional Clinic Pediatrics", beats: 22, distanceMiles: 3.5, overlapPct: 90, rating: 4.6, reviews: 1310, website: "austinregionalclinic.com", verified: "verified" },
    { name: "Bee Cave Pediatrics", beats: 13, distanceMiles: 6.2, overlapPct: 90, rating: 4.9, reviews: 402, website: "beecavepediatrics.com", verified: "verified" },
    { name: "Hill Country Kids Care", beats: 9, distanceMiles: 9.0, overlapPct: 80, rating: 4.8, reviews: 221, website: "hillcountrykids.com", verified: "verified" },
  ],
  rankProfile: "strong",
  bottomLine: "Strong at home; the growth is in Round Rock and Cedar Park.",
  findings: [
    { level: "strength", text: "Top-3 for 8 of 10 keywords in Austin." },
    { level: "watch", text: "Only 3 of 20 slots on page 1 in Round Rock and Cedar Park." },
    { level: "watch", text: "Facebook page has no reviews enabled." },
    { level: "strength", text: "PageSpeed scores above 90 on every page and device." },
  ],
  reviews: { rating: 4.9, reviews: 287, yelp: [4.5, 38], facebook: [null, 0] },
  notListed: [],
  aiOthers: {},
};

const meridian: Seed = {
  id: "1038",
  intake: {
    name: "Dr. Samuel Okafor", company: "Meridian Dermatology", cell: "(303) 555-0155", office: "(303) 555-0150",
    email: "front@meridianderm.com", website: "https://meridianderm.com/", address: "1800 Wazee St, Denver, CO 80202",
    referral: "Conference", vertical: "Medical", comments: "",
  },
  status: "ready", currentStep: 12, startedAt: "2026-09-02T10:30:00",
  wordpress: true,
  services: ["Medical Dermatology", "Skin Cancer Screening", "Acne Treatment", "Cosmetic Dermatology", "Mohs Surgery"],
  cities: [
    { name: "Denver", state: "CO", population: 715522, distanceMiles: 0, home: true },
    { name: "Aurora", state: "CO", population: 386261, distanceMiles: 10 },
    { name: "Lakewood", state: "CO", population: 155984, distanceMiles: 7 },
    { name: "Westminster", state: "CO", population: 116317, distanceMiles: 11 },
  ],
  keywords: ["Dermatologist", "Skin Cancer Screening", "Acne Treatment", "Mohs Surgery", "Eczema Doctor", "Psoriasis Treatment", "Mole Removal", "Botox Dermatologist", "Rosacea Treatment", "Pediatric Dermatologist"],
  extraKeywords: ["Laser Skin Treatment"],
  competitors: [
    { name: "Denver Skin Clinic", beats: 17, distanceMiles: 1.1, overlapPct: 90, rating: 4.7, reviews: 540, website: "denverskinclinic.com", verified: "verified" },
    { name: "Colorado Dermatology Institute", beats: 15, distanceMiles: 4.8, overlapPct: 80, rating: 4.8, reviews: 912, website: "coloradoderm.com", verified: "verified" },
    { name: "Cherry Creek Dermatology", beats: 10, distanceMiles: 3.9, overlapPct: 80, rating: 4.9, reviews: 377, website: "cherrycreekderm.com", verified: "verified" },
  ],
  rankProfile: "mixed",
  bottomLine: "Page 1 in Denver, below the fold everywhere.",
  findings: [
    { level: "attention", text: "Only 2 top-3 positions across 30 slots. Competitors hold the top 3 for every high-intent keyword." },
    { level: "watch", text: "Bing listing shows the old Blake Street address." },
    { level: "strength", text: "Content is original: all three pages under the 5% Copyscape threshold." },
  ],
  reviews: { rating: 4.7, reviews: 198, yelp: [4.3, 41], facebook: [4.8, 22] },
  notListed: [],
  aiOthers: {},
};

const oakStreet: Seed = {
  id: "1037",
  intake: {
    name: "Dr. Helen Park", company: "Oak Street Orthodontics", cell: "(614) 555-0188", office: "(614) 555-0180",
    email: "smile@oakstreetortho.com", website: "https://oakstreetortho.com/", address: "88 Oak St, Columbus, OH 43215",
    referral: "Referral", vertical: "Dental", comments: "",
  },
  status: "sent", currentStep: 12, startedAt: "2026-09-01T09:45:00", approvedBy: "Dulmini Dodawatte", approvedAt: "2026-09-01T16:12:00",
  ae: "Lila Stone", notify: "Slack + Email",
  wordpress: true,
  services: ["Braces", "Invisalign", "Early Orthodontics", "Adult Orthodontics", "Retainers"],
  cities: [
    { name: "Columbus", state: "OH", population: 913175, distanceMiles: 0, home: true },
    { name: "Dublin", state: "OH", population: 49328, distanceMiles: 15 },
    { name: "Westerville", state: "OH", population: 39190, distanceMiles: 13 },
    { name: "Newark", state: "OH", population: 49934, distanceMiles: 33 },
  ],
  keywords: ["Orthodontist", "Braces", "Invisalign", "Kids Braces", "Adult Braces", "Clear Aligners", "Retainers", "Orthodontist Near Me", "Braces Cost", "Early Orthodontic Treatment"],
  extraKeywords: [],
  competitors: [
    { name: "Columbus Orthodontic Group", beats: 12, distanceMiles: 2.6, overlapPct: 90, rating: 4.9, reviews: 733, website: "columbusortho.com", verified: "verified" },
    { name: "Smile Doctors Dublin", beats: 9, distanceMiles: 14.0, overlapPct: 90, rating: 4.8, reviews: 512, website: "smiledoctors.com", verified: "verified" },
  ],
  rankProfile: "strong",
  bottomLine: "Well placed in Columbus; Dublin is the open market.",
  findings: [
    { level: "strength", text: "Top-3 for 7 of 10 keywords in Columbus." },
    { level: "watch", text: "No page-1 presence in Dublin for Invisalign or clear aligners." },
    { level: "strength", text: "Listings match on all six platforms." },
  ],
  reviews: { rating: 4.9, reviews: 421, yelp: [4.6, 19], facebook: [5.0, 63] },
  notListed: [],
  aiOthers: {},
};

const SEEDS: Seed[] = [everAndEver, brightSmile, harbor, lakeside, meridian, oakStreet];

/* ------------------------------------------------------------------ */
/* Builders                                                              */
/* ------------------------------------------------------------------ */
function rankFor(profile: Seed["rankProfile"], seed: string, cityIdx: number): number | null {
  if (profile === "all-poor") return null;
  const r = rnd(seed);
  const homeBoost = cityIdx === 0 ? 0.35 : 0;
  const strong = profile === "strong" ? 0.25 : 0;
  const p = r + homeBoost + strong;
  if (p > 1.05) return 1 + (hash(seed + "a") % 3);       // 1-3
  if (p > 0.75) return 4 + (hash(seed + "b") % 7);       // 4-10
  return null;                                            // not on page 1
}

export function buildRanks(profile: Seed["rankProfile"], id: string, keywords: string[], cityCount: number, who = "client"): RankGrid {
  const grid: RankGrid = {};
  for (const k of keywords) {
    grid[k] = Array.from({ length: cityCount }, (_, c) => rankFor(profile, `${id}|${who}|${k}|${c}`, c));
  }
  return grid;
}

function competitorRanks(id: string, name: string, keywords: string[], cityCount: number): RankGrid {
  const grid: RankGrid = {};
  for (const k of keywords) {
    grid[k] = Array.from({ length: cityCount }, (_, c) => {
      const r = rnd(`${id}|${name}|${k}|${c}`);
      if (r > 0.55) return 1 + (hash(`${id}${name}${k}${c}x`) % 3);
      if (r > 0.25) return 4 + (hash(`${id}${name}${k}${c}y`) % 7);
      return null;
    });
  }
  return grid;
}

function buildListings(s: Seed): Listing[] {
  const v = s.intake.vertical;
  const nameOnFile = s.intake.company;
  const addr = s.intake.address;
  const phone = s.intake.office;
  const notListed = new Set(s.notListed ?? []);
  return PLATFORMS.map((platform) => {
    const source: Listing["source"] = platform === "Google" || platform === "Yelp" ? "api" : "search";
    if (platform === "Zocdoc" && v === "Legal") {
      return { platform, name: null, address: null, phone: null, url: null, match: "not-applicable", reason: "Zocdoc lists medical providers only", source, confirmed: true };
    }
    if (notListed.has(platform)) {
      return { platform, name: null, address: null, phone: null, url: null, match: "not-listed", source, confirmed: false };
    }
    const slug = nameOnFile.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const urls: Record<string, string> = {
      Google: `https://www.google.com/maps/search/${encodeURIComponent(nameOnFile)}`,
      Bing: `https://www.bing.com/maps?q=${encodeURIComponent(nameOnFile)}`,
      Yelp: `https://www.yelp.com/biz/${slug}`,
      Facebook: `https://www.facebook.com/${slug}`,
      "Yellow Pages": `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(nameOnFile)}`,
      Zocdoc: `https://www.zocdoc.com/practice/${slug}`,
    };
    let match: Listing["match"] = "match";
    let shownPhone = phone;
    let shownAddr = addr;
    if (s.id === "1041" && platform === "Yelp") { match = "mismatch"; shownPhone = "(919) 555-0199"; }
    if (s.id === "1038" && platform === "Bing") { match = "mismatch"; shownAddr = "1550 Blake St, Denver, CO 80202"; }
    return { platform, name: nameOnFile, address: shownAddr, phone: shownPhone, url: urls[platform], match, source, confirmed: source === "api" };
  });
}

function buildAiMode(s: Seed, keywords: string[], ranks: RankGrid): AiModeRow[] {
  return keywords.map((k, i) => {
    const shows = s.aiOthers[k] ? false : (ranks[k]?.[0] ?? 99) <= 3 && rnd(`${s.id}ai${k}`) > 0.4;
    const others = s.aiOthers[k] ?? s.competitors.slice(0, 3).map((c) => c.name);
    return { keyword: k, shows, others: shows ? [] : others, checked: i < 2 };
  });
}

function buildPageSpeed(s: Seed): PageSpeedRow[] {
  const base = s.id === "1042" ? [59, 69, 94, 96] : s.id === "1041" ? [48, 71, 63, 82] : s.id === "1039" ? [92, 97, 94, 98] : [66, 81, 74, 88];
  const home = s.intake.website;
  const svc = home.replace(/\/$/, "") + "/services/";
  const mk = (page: string, url: string, device: "Mobile" | "Desktop", perf: number, i: number): PageSpeedRow => ({
    page, url, device, performance: perf, accessibility: 92 + (hash(s.id + i + "a") % 8), bestPractices: 90 + (hash(s.id + i + "b") % 11), seo: 95 + (hash(s.id + i + "c") % 6),
  });
  return [
    mk("Home Page", home, "Mobile", base[0], 0), mk("Home Page", home, "Desktop", base[1], 1),
    mk("Key Service Page", svc, "Mobile", base[2], 2), mk("Key Service Page", svc, "Desktop", base[3], 3),
  ];
}

function buildCopyscape(s: Seed): CopyscapeRow[] {
  const home = s.intake.website.replace(/\/$/, "");
  const rows: CopyscapeRow[] = [
    { url: home + "/", allowedPct: 5, foundPct: s.id === "1042" ? 15 : 1 + (hash(s.id + "cs0") % 4), finding: s.id === "1042" ? "The homepage value statement matches the legacy Squarespace site." : "No meaningful matches." },
    { url: home + "/services/", allowedPct: 5, foundPct: hash(s.id + "cs1") % 4, finding: "No meaningful matches." },
    { url: home + "/about/", allowedPct: 5, foundPct: hash(s.id + "cs2") % 3, finding: "No meaningful matches." },
  ];
  if (s.copyscapeHit) rows[1] = { url: s.copyscapeHit.url, allowedPct: 5, foundPct: s.copyscapeHit.pct, finding: s.copyscapeHit.finding };
  return rows;
}

function buildReviews(s: Seed): ReviewRow[] {
  const you = `${s.intake.company} (YOU)`;
  const rows: ReviewRow[] = [
    { who: you, platform: "Google", rating: s.reviews.rating, reviews: s.reviews.reviews, note: "" },
    { who: you, platform: "Yelp", rating: s.reviews.yelp[0], reviews: s.reviews.yelp[1], note: s.reviews.yelp[0] == null ? "Listed but not yet rated." : "" },
    { who: you, platform: "Facebook", rating: s.reviews.facebook[0], reviews: s.reviews.facebook[1], note: s.reviews.facebook[0] == null ? "Page exists but shows no public rating." : "" },
  ];
  for (const c of s.competitors.filter((x) => x.verified === "verified").slice(0, 4)) {
    rows.push({ who: c.name, platform: "Google", rating: c.rating, reviews: c.reviews, note: "" });
    rows.push({ who: c.name, platform: "Yelp", rating: Math.round((c.rating - 1.2) * 10) / 10, reviews: Math.round(c.reviews * 0.15), note: "" });
    rows.push({ who: c.name, platform: "Facebook", rating: null, reviews: null, note: "Page found but shows no public star rating." });
  }
  return rows;
}

export function stepDetail(r: Report, stepId: number): string {
  const selCities = r.cities.filter((c) => c.selected).length;
  const selKw = r.keywords.filter((k) => k.selected);
  const total = selKw.length * selCities;
  const onP1 = selKw.reduce((n, k) => n + (r.ranks[k.keyword] ?? []).filter((v) => v != null).length, 0);
  const over = r.copyscape.filter((c) => c.foundPct > c.allowedPct).length;
  const missing = r.listings.filter((l) => l.match === "not-listed").map((l) => l.platform);
  const picked = r.competitors.filter((c) => c.selected).length;
  switch (stepId) {
    case 1: return r.wordpress ? "WordPress detected" + (r.legacySite ? ", legacy site found" : "") : "Not WordPress";
    case 2: return `${selKw.length} keywords, ${selCities} cities`;
    case 3: return `${onP1} / ${total} on page 1`;
    case 4: return "4 runs, scores saved";
    case 5: return over ? `${over} page${over === 1 ? "" : "s"} over 5%` : "All pages under 5%";
    case 6: return missing.length ? `${missing.join(", ")} not listed` : "All 6 platforms found";
    case 7: return "Client and competitors";
    case 8: return picked ? `${picked} competitors chosen` : "Pick 2 to 4";
    case 9: return picked ? `${picked * total} positions pulled` : "";
    case 10: return `${r.aiMode.filter((a) => a.shows).length} / ${r.aiMode.length} keywords name the practice`;
    case 11: return `${r.findings.length} findings drafted`;
    case 12: return "Google Sheet, 6 tabs";
    default: return "";
  }
}

function buildSteps(currentStep: number, status: ReportStatus): Step[] {
  return STEP_TITLES.map((title, i) => {
    const id = i + 1;
    let state: Step["state"] = "todo";
    if (id < currentStep) state = "done";
    else if (id === currentStep) {
      if (status === "waiting") state = "waiting";
      else if (status === "running") state = "running";
      else if (status === "ready" || status === "sent") state = "done";
    }
    return { id, title, state, detail: "" };
  });
}

function fmtTime(iso: string, plusMin = 0): string {
  const d = new Date(iso); d.setMinutes(d.getMinutes() + plusMin);
  return d.toTimeString().slice(0, 5);
}

function buildLog(s: Seed, r: Report): Report["log"] {
  const t = s.startedAt;
  const log = [{ time: fmtTime(t), text: `Report created by Dulmini Dodawatte` }];
  if (r.currentStep > 1) log.push({ time: fmtTime(t, 1), text: r.wordpress ? "WordPress detected" : "Site is not on WordPress" });
  if (r.currentStep > 2) log.push({ time: fmtTime(t, 4), text: "Keywords and cities approved by Dulmini" });
  if (r.currentStep > 3) log.push({ time: fmtTime(t, 9), text: `Rank checks complete, ${stepDetail(r, 3)}` });
  if (r.currentStep > 5) log.push({ time: fmtTime(t, 11), text: `Copyscape: ${stepDetail(r, 5).toLowerCase()}` });
  if (r.currentStep > 6) log.push({ time: fmtTime(t, 14), text: `Listings: ${stepDetail(r, 6).toLowerCase()}` });
  if (r.currentStep > 8) log.push({ time: fmtTime(t, 22), text: "Competitors confirmed by Dulmini" });
  if (r.currentStep > 10) log.push({ time: fmtTime(t, 31), text: "Listings and AI Mode confirmed by Dulmini" });
  if (r.status === "ready") log.push({ time: fmtTime(t, 33), text: "Report ready to review" });
  if (r.status === "sent" && r.approvedAt) {
    log.push({ time: fmtTime(r.approvedAt), text: `Approved by ${r.approvedBy}` });
    log.push({ time: fmtTime(r.approvedAt, 1), text: `Google Sheet created in ${DRIVE_FOLDER}` });
    log.push({ time: fmtTime(r.approvedAt, 1), text: `Link sent to ${r.ae} via ${r.notify}` });
    log.push({ time: fmtTime(r.approvedAt, 95), text: `${r.ae} approved the report` });
  }
  return log.reverse();
}

export function buildReport(s: Seed): Report {
  const selectedCities = s.cities.map((c, i) => ({ ...c, selected: i < 3 }));
  const keywords: KeywordOption[] = [
    ...s.keywords.map((k) => ({ keyword: k, selected: true, source: "website" as const })),
    ...s.extraKeywords.map((k) => ({ keyword: k, selected: false, source: "website" as const })),
  ];
  const kwList = s.keywords;
  const ranks = buildRanks(s.rankProfile, s.id, kwList, 3);
  const afterPick = s.currentStep > 8 || s.status === "ready" || s.status === "sent";
  const competitors: Competitor[] = s.competitors.map((c, i) => ({
    ...c, id: `${s.id}-c${i + 1}`, selected: c.verified === "verified" && (afterPick || s.status === "waiting" && s.currentStep === 8) && i < 4,
  }));
  const compRanks: Record<string, RankGrid> = {};
  for (const c of competitors) compRanks[c.id] = competitorRanks(s.id, c.name, kwList, 3);
  const listings = buildListings(s);
  const delivery: Delivery = s.status === "sent"
    ? { sheetUrl: "#", driveFolder: DRIVE_FOLDER, sentTo: s.ae ?? "Lila Stone", sentVia: s.notify ?? "Slack + Email", sentAt: s.approvedAt, aeApproval: "approved", hubspot: "not-connected" }
    : { driveFolder: DRIVE_FOLDER, aeApproval: "not-sent", hubspot: "not-connected" };
  const r: Report = {
    id: s.id, intake: s.intake, ae: s.ae ?? "Lila Stone", notify: s.notify ?? "Slack + Email", delivery,
    status: s.status, currentStep: s.currentStep, nextStepLabel: "", startedAt: s.startedAt,
    approvedBy: s.approvedBy, approvedAt: s.approvedAt, wordpress: s.wordpress, legacySite: s.legacySite, services: s.services,
    cities: selectedCities, keywords, steps: buildSteps(s.currentStep, s.status), log: [], ranks, competitors, competitorRanks: compRanks,
    listings, aiMode: buildAiMode(s, kwList, ranks), pageSpeed: buildPageSpeed(s), copyscape: buildCopyscape(s), reviews: buildReviews(s),
    bottomLine: s.bottomLine, findings: s.findings,
  };
  if (afterPick) r.listings = r.listings.map((l) => ({ ...l, confirmed: true }));
  if (afterPick) r.aiMode = r.aiMode.map((a) => ({ ...a, checked: true }));
  for (const st of r.steps) if (st.state !== "todo") st.detail = stepDetail(r, st.id);
  r.log = buildLog(s, r);
  r.nextStepLabel = nextStepLabel(r);
  return r;
}

export function nextStepLabel(r: Report): string {
  if (r.status === "sent") return r.approvedBy ? `Approved by ${r.approvedBy.split(" ")[0]}` : "Sent";
  if (r.status === "ready") return "Review and approve";
  if (r.status === "draft") return "Start research";
  const cp = CHECKPOINTS[r.currentStep];
  if (r.status === "waiting" && cp) {
    return cp === 1 ? "Checkpoint 1: keywords and cities" : cp === 2 ? "Checkpoint 2: pick competitors" : "Checkpoint 3: listings and AI Mode";
  }
  return `Step ${r.currentStep} of 12: ${STEP_TITLES[r.currentStep - 1].toLowerCase()}`;
}

export function seedReports(): Report[] { return SEEDS.map(buildReport); }

/** Vertical keyword suggestions used when a brand-new report is created in the demo. */
export const VERTICAL_KEYWORDS: Record<Vertical, string[]> = {
  Dental: brightSmile.keywords, Medical: lakeside.keywords, "Med spa": everAndEver.keywords, Legal: harbor.keywords,
};
export const VERTICAL_SERVICES: Record<Vertical, string[]> = {
  Dental: brightSmile.services, Medical: lakeside.services, "Med spa": everAndEver.services, Legal: harbor.services,
};
export const VERTICAL_CITIES: Record<Vertical, Omit<CityOption, "selected">[]> = {
  Dental: brightSmile.cities, Medical: lakeside.cities, "Med spa": everAndEver.cities, Legal: harbor.cities,
};
export const VERTICAL_COMPETITORS: Record<Vertical, Seed["competitors"]> = {
  Dental: brightSmile.competitors, Medical: lakeside.competitors, "Med spa": everAndEver.competitors, Legal: harbor.competitors,
};
export type { Seed };
