/**
 * Counterparty Risk Intelligence — frontend domain model.
 *
 * These types are the contract between the UI and whatever supplies the data.
 * Today everything is served from `src/data/demo.ts` (provenance: "DEMO").
 * Later, the same shapes can be produced by bank systems, a graph database,
 * or risk models without touching component code.
 */

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";

/** Where a value came from — surfaced in the UI so analysts can trust it. */
export type Provenance = "DEMO" | "OBSERVED" | "CALCULATED" | "MODEL_OUTPUT" | "ANALYST_JUDGMENT";

export type Trend = "UP" | "DOWN" | "FLAT";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";

export interface Money {
  amount: number;
  currency: CurrencyCode;
  /** Display unit, e.g. "Cr" (crore) or "Mn". */
  unit?: "Cr" | "Mn" | "Bn" | "" | undefined;
}

export interface Provenanced<T> {
  value: T;
  provenance: Provenance;
  asOf?: string | undefined;
  sourceIds?: string[] | undefined;
}

/* ------------------------------------------------------------------ *
 * Entities
 * ------------------------------------------------------------------ */

export type EntityType =
  | "COMPANY"
  | "PERSON"
  | "BANK"
  | "COUNTRY"
  | "SECTOR"
  | "PROJECT"
  | "COLLATERAL"
  | "FUND";

export interface EntityBase {
  id: string;
  entityType: EntityType;
  name: string;
  country?: string | undefined;
  riskLevel: RiskLevel;
  riskScore?: number | undefined;
  provenance: Provenance;
}

export interface Person extends EntityBase {
  entityType: "PERSON";
  role?: string | undefined;
  nationality?: string | undefined;
  pep?: boolean | undefined;
}

export interface CompanyIdentity {
  legalName: string;
  lei?: string | undefined;
  registrationNumber?: string | undefined;
  country: string;
  incorporationDate?: string | undefined;
  industry: string;
  sector: string;
  parentId?: string | undefined;
  parentName?: string | undefined;
  uboName?: string | undefined;
  listing: "PUBLIC" | "PRIVATE" | "STATE_OWNED" | "UNKNOWN";
}

export interface BusinessProfile {
  revenue: Money;
  ebitda: Money;
  totalAssets: Money;
  totalLiabilities: Money;
  debt: Money;
  cash: Money;
  employees: number;
  fiscalYear: string;
}

export interface RiskCriticality {
  bankRelationshipCriticality: RiskLevel;
  sectorCriticality: RiskLevel;
  operationalCriticality: RiskLevel;
  systemicImportance: RiskLevel;
  substitutability: RiskLevel;
  notes?: string | undefined;
}

export type BankRelationship =
  | "Borrower"
  | "Guarantor"
  | "Depositor"
  | "Trading Counterparty"
  | "Vendor"
  | "Prospect";

export interface Company extends EntityBase {
  entityType: "COMPANY" | "BANK";
  identity: CompanyIdentity;
  businessProfile: BusinessProfile;
  criticality: RiskCriticality;
  bankRelationship: BankRelationship;
  customerId?: string | undefined;
  isBankClient: boolean;
  lastUpdated: string;
}

export type Entity = Company | Person | EntityBase;

/* ------------------------------------------------------------------ *
 * Relationships — taxonomy driven (Level 1 / Level 2 / Ancillary)
 * ------------------------------------------------------------------ */

export type RelationshipLevel = "LEVEL_1" | "LEVEL_2" | "ANCILLARY";

/**
 * Relationship categories and types are intentionally open strings driven by
 * the taxonomy registry, so new rows from the Excel taxonomy can be added
 * without any UI change.
 */
export interface RelationshipTaxonomyEntry {
  taxonomyId: string;
  level: RelationshipLevel;
  category: string;
  type: string;
  definition: string;
  entityAType: string;
  entityBType: string;
  internalDataSources: string[];
  externalDataSources: string[];
  evidenceAttributes: string[];
  riskRelevance: string;
  dataRefresh: string;
  implementationNotes?: string | undefined;
}

export interface Relationship {
  relationshipId: string;
  taxonomyId: string;
  level: RelationshipLevel;
  category: string;
  /** e.g. OWNS, GUARANTEES, SUPPLIES, FUNDS, CUSTOMER OF, DIRECTOR OF … */
  type: string;
  entityA: string;
  entityB: string;
  definition: string;
  /** 0–1 relationship strength. */
  strength: number;
  exposure?: Money | undefined;
  /** 0–1 dependency of A on B. */
  dependency: number;
  riskRelevance: string;
  confidence: Confidence;
  sourceIds: string[];
  effectiveDate: string;
  lastRefreshed: string;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ *
 * Risk
 * ------------------------------------------------------------------ */

export type RiskCategory =
  | "Credit"
  | "Default"
  | "Exposure"
  | "Contagion"
  | "Recovery"
  | "Country"
  | "Sector"
  | "Operational"
  | "Liquidity"
  | "Ownership"
  | "Supplier"
  | "Customer"
  | "Funding"
  | "Legal"
  | "Collateral";

export interface RiskScore {
  score: number;
  level: RiskLevel;
  previousScore?: number | undefined;
  trend: Trend;
  provenance: Provenance;
  asOf: string;
}

export interface Risk {
  id: string;
  category: RiskCategory | string;
  label: string;
  score: RiskScore;
  /** Materiality 0–1, drives node size on the Risk Source Map. */
  materiality: number;
  reasons: string[];
  exposure?: Money | undefined;
  potentialImpact: RiskLevel;
  sourceIds: string[];
  relatedEntityIds?: string[] | undefined;
  summary: string;
}

export interface RiskDriver {
  id: string;
  title: string;
  riskCategory: string;
  severity: RiskLevel;
  explanation: string;
  impact: string;
  exposure?: Money | undefined;
  sourceIds: string[];
}

export interface RiskEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  severity: RiskLevel;
  category: string;
  sourceIds: string[];
}

/* ------------------------------------------------------------------ *
 * Exposure, assets, collateral, guarantees
 * ------------------------------------------------------------------ */

export interface ExposureSummary {
  total: Money;
  funded: Money;
  unfunded: Money;
  potentialFutureExposure: Money;
  collateral: Money;
  net: Money;
  asOf: string;
  provenance: Provenance;
}

export interface ExposureBreakdownItem {
  key: string;
  label: string;
  amount: number;
  riskLevel: RiskLevel;
  currency: CurrencyCode;
  dimension: "PRODUCT" | "SECTOR" | "COUNTRY" | "MATURITY" | "ENTITY";
  entityId?: string | undefined;
}

export type EncumbranceStatus = "UNENCUMBERED" | "PARTIALLY_ENCUMBERED" | "ENCUMBERED";

export interface Asset {
  id: string;
  name: string;
  type: string;
  value: Money;
  ownership: string;
  encumbrance: EncumbranceStatus;
  collateralValue: Money;
  haircutPct: number;
  valuationDate: string;
  recoveryPriority: number;
  provenance: Provenance;
}

export interface Collateral {
  id: string;
  assetId: string;
  type: string;
  eligible: boolean;
  marketValue: Money;
  haircutPct: number;
  collateralValue: Money;
  valuationDate: string;
  custodian?: string | undefined;
}

export interface Guarantee {
  id: string;
  guarantorId: string;
  guarantorName: string;
  beneficiaryEntityId: string;
  amount: Money;
  type: string;
  enforceability: RiskLevel;
  expiry?: string | undefined;
}

export interface RecoverySummary {
  totalAssets: Money;
  eligibleCollateral: Money;
  collateralValue: Money;
  blendedHaircutPct: number;
  estimatedRecovery: Money;
  recoveryPct: number;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ *
 * Contagion
 * ------------------------------------------------------------------ */

export interface ContagionPath {
  id: string;
  hops: Array<{
    entityId: string;
    entityName: string;
    entityType: EntityType;
    relationshipType?: string | undefined;
  }>;
  transmissionChannel: string;
  exposure: Money;
  dependency: number;
  potentialImpact: string;
  riskLevel: RiskLevel;
  provenance: Provenance;
}

/* ------------------------------------------------------------------ *
 * Evidence & sources
 * ------------------------------------------------------------------ */

export type SourceOrigin = "INTERNAL" | "EXTERNAL";

export interface Source {
  id: string;
  name: string;
  sourceType: string;
  origin: SourceOrigin;
  dataOwner: string;
  date: string;
  lastRefreshed: string;
  refreshCadence: string;
  confidence: Confidence;
  verification: "VERIFIED" | "PENDING" | "UNVERIFIED";
}

export interface Evidence {
  id: string;
  sourceId: string;
  title: string;
  excerpt: string;
  documentRef?: string | undefined;
  capturedAt: string;
  linkedTo: Array<{ kind: "RISK" | "RELATIONSHIP" | "ENTITY" | "ASSET"; id: string }>;
  confidence: Confidence;
}

/* ------------------------------------------------------------------ *
 * Actions & early warning
 * ------------------------------------------------------------------ */

export type ActionStatus = "Open" | "In Progress" | "Pending Review" | "Completed" | "Escalated";

export type ActionPriority = "P1" | "P2" | "P3";

export interface RiskAction {
  id: string;
  risk: string;
  recommendedAction: string;
  priority: ActionPriority;
  owner: string;
  dueDate: string;
  status: ActionStatus;
  relatedRiskId?: string | undefined;
}

export interface EarlyWarningIndicator {
  id: string;
  indicator: string;
  current: string;
  previous: string;
  trend: Trend;
  /** True when the trend direction is adverse. */
  adverse: boolean;
  threshold: string;
  riskLevel: RiskLevel;
  date: string;
  status: "Breached" | "Watch" | "Within Threshold";
  category: string;
  formula?: string | undefined;
  provenance?: Provenance | undefined;
}

/* ------------------------------------------------------------------ *
 * Graph view model (consumed by RelationshipGraph / RiskSourceMap)
 * ------------------------------------------------------------------ */

export type GraphViewMode = "RELATIONSHIP" | "EXPOSURE" | "RISK" | "CONTAGION" | "OWNERSHIP";

export interface GraphNode {
  id: string;
  label: string;
  entityType: EntityType;
  nodeRole: string;
  riskLevel: RiskLevel;
  /** 0–1 materiality → node radius. */
  weight: number;
  level: RelationshipLevel;
  /** Normalised layout position, 0–1 in both axes. */
  x: number;
  y: number;
  exposure?: Money | undefined;
}

export interface GraphEdge {
  id: string;
  relationshipId: string;
  from: string;
  to: string;
  type: string;
  riskLevel: RiskLevel;
  strength: number;
}

export interface RelationshipGraphData {
  centerId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/* ------------------------------------------------------------------ *
 * Counterparty dossier — everything the UI needs for one counterparty
 * ------------------------------------------------------------------ */

export interface CounterpartyDossier {
  company: Company;
  overallRisk: RiskScore;
  risks: Risk[];
  riskDrivers: RiskDriver[];
  relationships: Relationship[];
  graph: RelationshipGraphData;
  exposure: ExposureSummary;
  exposureBreakdown: ExposureBreakdownItem[];
  assets: Asset[];
  collateral: Collateral[];
  guarantees: Guarantee[];
  recovery: RecoverySummary;
  contagionPaths: ContagionPath[];
  indicators: EarlyWarningIndicator[];
  actions: RiskAction[];
  sources: Source[];
  evidence: Evidence[];
  events: RiskEvent[];
}
