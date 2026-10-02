export type StepType = 'premise' | 'derivation' | 'goal';
export type CheckSeverity = 'error' | 'warning' | 'info';

export interface ProofStep {
  id: string;
  /** 稳定编号：导出/导入与跨设备合并时按此编号贴回，与排列顺序无关 */
  key: string;
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
  symbols: Record<string, string>;
}

export interface ProofDocument {
  id: string;
  title: string;
  author: string;
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
  versions: ProofVersion[];
  /** 已分配的最大稳定编号序号，保证每一步编号永不复用 */
  stepSeq: number;
  updatedAt: string;
}

/** 离线分支交换包：从一台电脑导出，在另一台电脑导入 */
export interface ProofBundle {
  format: 'sologsb-proof-bundle';
  version: 1;
  exportedAt: string;
  docId: string;
  title: string;
  /** 导出时留下的版本快照 id，versions 中包含其完整内容，作为三方合并基线 */
  baselineId: string | null;
  steps: ProofStep[];
  goal: string;
  symbols: Record<string, string>;
  stepSeq: number;
  /** 导出方当时保留的全部旧快照，合并时去重并入 */
  versions: ProofVersion[];
}

/** 合并中的步骤状态 */
export type MergeStepStatus =
  | 'unchanged'
  | 'local-only'
  | 'incoming-only'
  | 'changed-local'
  | 'changed-incoming'
  | 'changed-both'
  | 'deleted-local'
  | 'deleted-incoming'
  | 'changed-local-deleted-incoming'
  | 'deleted-local-changed-incoming';

export type MergeGoalStatus = 'unchanged' | 'changed-local' | 'changed-incoming' | 'changed-both';

export type MergeSymbolStatus =
  | 'unchanged'
  | 'local-only'
  | 'incoming-only'
  | 'changed-local'
  | 'changed-incoming'
  | 'changed-both'
  | 'deleted-local'
  | 'deleted-incoming'
  | 'changed-local-deleted-incoming'
  | 'deleted-local-changed-incoming';

export interface MergePending {
  id: string;
  kind: 'step' | 'step-moddelete' | 'symbol' | 'symbol-moddelete' | 'goal' | 'dangling' | 'cycle';
  /** 需要裁决的步骤稳定编号（step / step-moddelete / dangling / cycle 使用） */
  stepKey?: string;
  /** dangling：引用者编号；cycle：成环步骤编号 */
  referrerKeys?: string[];
  /** 被引用但一侧已删除的编号（dangling 使用） */
  targetKey?: string;
  symbol?: string;
  localSummary: string;
  incomingSummary: string;
}

export type MergeResolution =
  | 'keep-local'
  | 'keep-incoming'
  | 'keep'
  | 'delete'
  | 'break-local'
  | 'break-incoming';

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
