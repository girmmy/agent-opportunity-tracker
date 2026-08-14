export const OPPORTUNITY_TYPES = [
  'Internship',
  'Contract',
  'Program',
  'Research',
  'Hackathon',
  'Scholarship',
  'Full-time',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const STATUSES = [
  'Not Applied Yet',
  'Not Yet Open',
  'In Progress (Applying)',
  'Waiting for Response',
  'Interview in Progress',
  'Offer Received',
  'Accepted / Active',
  'Return Offer',
  'Completed',
  'Rejected',
  'Withdrawn / Lapsed',
] as const;
export type Status = (typeof STATUSES)[number];

export const FITS = ['Strong', 'Good', 'Weak', 'Unknown'] as const;
export type Fit = (typeof FITS)[number];

export const CATEGORIES = [
  'SWE',
  'AI/ML',
  'Product',
  'Data',
  'Research',
  'Other',
  'Unclear',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Opportunity {
  id: string;
  organization: string;
  role: string;
  opportunity_type: OpportunityType;
  category: Category;
  cycle: string | null;
  status: Status;
  fit: Fit;
  date_applied: string | null;
  deadline: string | null;
  listing_url: string | null;
  resume_used: string | null;
  source: string | null;
  notes: string | null;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** True when an agent surfaced this itself rather than the user logging it. */
  suggested_by_agent?: boolean;
}

/** Fields a client is allowed to write. Everything else is server-managed. */
export const EDITABLE_FIELDS = [
  'organization',
  'role',
  'opportunity_type',
  'category',
  'cycle',
  'status',
  'fit',
  'date_applied',
  'deadline',
  'listing_url',
  'resume_used',
  'source',
  'notes',
  'details',
  'suggested_by_agent',
] as const;

export const ACTIVE_STATUSES: Status[] = [
  'Accepted / Active',
  'Return Offer',
  'Offer Received',
];

export const IN_FLIGHT_STATUSES: Status[] = [
  'In Progress (Applying)',
  'Waiting for Response',
  'Interview in Progress',
];

export const CLOSED_STATUSES: Status[] = [
  'Completed',
  'Rejected',
  'Withdrawn / Lapsed',
];

/* Semantic color is kept separate from the accent hue: status and fit encode
   meaning, so they map to iOS system colors rather than brand blue. */
export const STATUS_COLORS: Record<Status, string> = {
  'Not Applied Yet': 'var(--label-3)',
  'Not Yet Open': 'var(--yellow)',
  'In Progress (Applying)': 'var(--orange)',
  'Waiting for Response': 'var(--blue)',
  'Interview in Progress': 'var(--purple)',
  'Offer Received': 'var(--teal)',
  'Accepted / Active': 'var(--green)',
  'Return Offer': 'var(--green)',
  Completed: 'var(--label-2)',
  Rejected: 'var(--red)',
  'Withdrawn / Lapsed': 'var(--label-3)',
};

export const TYPE_COLORS: Record<OpportunityType, string> = {
  Internship: 'var(--teal)',
  Contract: 'var(--orange)',
  Program: 'var(--indigo)',
  Research: 'var(--blue)',
  Hackathon: 'var(--pink)',
  Scholarship: 'var(--yellow)',
  'Full-time': 'var(--label-2)',
};

export const FIT_COLORS: Record<Fit, string> = {
  Strong: 'var(--green)',
  Good: 'var(--teal)',
  Weak: 'var(--orange)',
  Unknown: 'var(--label-3)',
};

/* ------------------------------------------------------------------ columns */

export interface ColumnDef {
  key: string;
  label: string;
  /** Identity columns can't be hidden — a row with neither is unreadable. */
  locked?: boolean;
  defaultVisible?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'organization', label: 'Organization', locked: true },
  { key: 'role', label: 'Role', locked: true },
  { key: 'opportunity_type', label: 'Type', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'fit', label: 'Fit', defaultVisible: true },
  { key: 'cycle', label: 'Cycle', defaultVisible: true },
  { key: 'date_applied', label: 'Applied', defaultVisible: true },
  { key: 'deadline', label: 'Deadline', defaultVisible: false },
  { key: 'category', label: 'Category', defaultVisible: false },
  { key: 'resume_used', label: 'Résumé', defaultVisible: false },
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'listing_url', label: 'Listing', defaultVisible: true },
  { key: 'notes', label: 'Notes', defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLUMNS = COLUMNS.filter(
  (c) => c.locked || c.defaultVisible
).map((c) => c.key);
