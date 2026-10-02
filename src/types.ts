export type StepType = 'premise' | 'derivation' | 'goal';
export type CheckSeverity = 'error' | 'warning' | 'info';

export interface ProofStep {
  id: string;
  type: StepType;
  statement: string;
  rule: string;
  references: string[];
  note: string;
  counterexample: string;
  alternative: string;
}

export interface ProofVersion {
  id: string;
  name: string;
  createdAt: string;
  steps: ProofStep[];
  goal: string;
}

export interface BranchSnapshot {
  id: string;
  name: string;
  createdAt: string;
  exportedFrom: string;
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
}

export const BRANCH_PACKAGE_FORMAT = 'gzhi-branch-package/v1';

export interface BranchPackage {
  format: typeof BRANCH_PACKAGE_FORMAT;
  documentId: string;
  documentTitle: string;
  source: string;
  exportedAt: string;
  snapshot: BranchSnapshot;
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
}

export interface ProofDocument {
  id: string;
  title: string;
  author: string;
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
  versions: ProofVersion[];
  branchSnapshots: BranchSnapshot[];
  updatedAt: string;
}

export interface ProofCheck {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  stepId?: string;
}

export interface ProofDiff {
  kind: 'same' | 'added' | 'removed' | 'changed';
  label: string;
  before: string;
  after: string;
}
