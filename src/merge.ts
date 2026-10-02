import type { BranchPackage, BranchSnapshot, ProofDocument, ProofStep } from './types';
import { BRANCH_PACKAGE_FORMAT } from './types';

/* ------------------------------------------------------------------ */
/* 类型定义                                                             */
/* ------------------------------------------------------------------ */

export type ScalarField = 'type' | 'statement' | 'rule' | 'note' | 'counterexample' | 'alternative';

const SCALAR_FIELDS: ScalarField[] = ['type', 'statement', 'rule', 'note', 'counterexample', 'alternative'];

const FIELD_LABEL: Record<ScalarField, string> = {
  type: '类型',
  statement: '命题',
  rule: '推理规则',
  note: '旁注',
  counterexample: '反例',
  alternative: '替代分支',
};

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export interface StepBothModifiedConflict {
  kind: 'step-both-modified';
  id: string;
  stepId: string;
  label: string;
  fields: ScalarField[];
  local: ProofStep;
  incoming: ProofStep;
  decided: 'local' | 'incoming' | null;
}

export interface StepDeleteModifiedConflict {
  kind: 'step-delete-modified';
  id: string;
  stepId: string;
  label: string;
  deletedBy: 'local' | 'incoming';
  kept: ProofStep;
  decided: 'restore' | 'delete' | null;
}

export interface RefAddedToDeletedConflict {
  kind: 'ref-added-to-deleted';
  id: string;
  /** 新增引用的步骤 */
  ownerId: string;
  ownerLabel: string;
  /** 被引用、且在一侧被删除的步骤 */
  targetId: string;
  targetLabel: string;
  addedBy: 'local' | 'incoming';
  deletedBy: 'local' | 'incoming';
  decided: 'restore' | 'drop' | null;
}

export interface SymbolBothModifiedConflict {
  kind: 'symbol-both-modified';
  id: string;
  key: string;
  local: string;
  incoming: string;
  base: string;
  decided: 'local' | 'incoming' | null;
}

export interface SymbolDeleteModifiedConflict {
  kind: 'symbol-delete-modified';
  id: string;
  key: string;
  modifiedValue: string;
  deletedBy: 'local' | 'incoming';
  decided: 'restore' | 'delete' | null;
}

export interface GoalBothModifiedConflict {
  kind: 'goal-both-modified';
  id: string;
  local: string;
  incoming: string;
  decided: 'local' | 'incoming' | null;
}

export type MergeConflict =
  | StepBothModifiedConflict
  | StepDeleteModifiedConflict
  | RefAddedToDeletedConflict
  | SymbolBothModifiedConflict
  | SymbolDeleteModifiedConflict
  | GoalBothModifiedConflict;

export type MergeChangeKind =
  | 'step-added'
  | 'step-removed'
  | 'step-field-changed'
  | 'ref-added'
  | 'ref-removed'
  | 'symbol-added'
  | 'symbol-removed'
  | 'symbol-changed'
  | 'goal-changed';

export interface MergeChange {
  kind: MergeChangeKind;
  label: string;
  detail: string;
  side: 'local' | 'incoming';
}

export interface MergedDocument {
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
}

export interface MergePreview {
  base: BranchSnapshot;
  snapshot: BranchSnapshot;
  fallbackBase: boolean;
  conflicts: MergeConflict[];
  changes: MergeChange[];
  /** 确认后写入的完整文档（冲突未决时为占位结果，pending 未清空不允许确认） */
  merged: MergedDocument;
}

/* ------------------------------------------------------------------ */
/* 工具                                                                 */
/* ------------------------------------------------------------------ */

export function isBranchPackage(value: unknown): value is BranchPackage {
  if (typeof value !== 'object' || value === null) return false;
  const pkg = value as Partial<BranchPackage>;
  return pkg.format === BRANCH_PACKAGE_FORMAT
    && typeof pkg.documentId === 'string'
    && Array.isArray(pkg.steps)
    && typeof pkg.snapshot === 'object'
    && pkg.snapshot !== null
    && Array.isArray((pkg.snapshot as BranchSnapshot).steps);
}

/** 比较除引用外的可编辑字段 */
function scalarEqual(a: ProofStep, b: ProofStep): boolean {
  return SCALAR_FIELDS.every((field) => a[field] === b[field]);
}

const trim = (value: string, length = 26): string => {
  const clean = value.replace(/\$/g, '');
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
};

/* ------------------------------------------------------------------ */
/* 基线                                                                 */
/* ------------------------------------------------------------------ */

export function findBase(document: ProofDocument, pkg: BranchPackage): { base: BranchSnapshot; fallback: boolean } {
  const hit = document.branchSnapshots.find((snapshot) => snapshot.id === pkg.snapshot.id);
  if (hit) return { base: hit, fallback: false };
  // 旧稿没有这份快照：把已有步骤/符号当作共同内容合成基线
  return {
    fallback: true,
    base: {
      id: `synthetic-${pkg.snapshot.id}`,
      name: `兼容基线（${pkg.snapshot.name}）`,
      createdAt: new Date().toISOString(),
      exportedFrom: document.id,
      goal: document.goal,
      symbols: structuredClone(document.symbols),
      steps: structuredClone(document.steps),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 合并规划                                                             */
/* ------------------------------------------------------------------ */

export function planMerge(document: ProofDocument, pkg: BranchPackage): MergePreview {
  const { base, fallback } = findBase(document, pkg);

  const localSteps = new Map(document.steps.map((step) => [step.id, step]));
  const incomingSteps = new Map(pkg.steps.map((step) => [step.id, step]));
  const baseSteps = new Map(base.steps.map((step) => [step.id, step]));

  const localIndex = new Map(document.steps.map((step, index) => [step.id, index + 1]));
  const incomingIndex = new Map(pkg.steps.map((step, index) => [step.id, index + 1]));
  const baseIndex = new Map(base.steps.map((step, index) => [step.id, index + 1]));
  const anyIndex = new Map<string, number>([...baseIndex, ...incomingIndex, ...localIndex]);

  const labelOf = (id: string): string => {
    const step = localSteps.get(id) ?? incomingSteps.get(id) ?? baseSteps.get(id);
    const index = anyIndex.get(id);
    const snippet = step ? trim(step.statement, 18) : '未知步骤';
    return index ? `步骤 ${index}（${snippet}）` : `步骤（${snippet}）`;
  };

  const conflicts: MergeConflict[] = [];
  const changes: MergeChange[] = [];

  const allStepIds = new Set<string>([...baseSteps.keys(), ...localSteps.keys(), ...incomingSteps.keys()]);

  /* ---- 步骤去留与字段冲突 ---- */
  allStepIds.forEach((id) => {
    const b = baseSteps.get(id);
    const l = localSteps.get(id);
    const r = incomingSteps.get(id);

    if (l && r) {
      // 双方都改了同一字段才冲突；只改一处自动接收（在 buildMerged 逐字段合并）
      if (b && !scalarEqual(b, l) && !scalarEqual(b, r) && !scalarEqual(l, r)) {
        const fields = SCALAR_FIELDS.filter((field) => b[field] !== l[field] && b[field] !== r[field] && l[field] !== r[field]);
        conflicts.push({ kind: 'step-both-modified', id: `conf-step-both-${id}`, stepId: id, label: labelOf(id), fields, local: l, incoming: r, decided: null });
      }
      return;
    }

    if (l && !r) {
      if (b && !fallback) {
        // incoming 删除；local 若改过删除物 → 待处理，否则自动接收删除
        if (!scalarEqual(b, l)) {
          conflicts.push({ kind: 'step-delete-modified', id: `conf-step-del-${id}`, stepId: id, label: labelOf(id), deletedBy: 'incoming', kept: l, decided: null });
        } else {
          changes.push({ kind: 'step-removed', label: labelOf(id), detail: trim(b.statement), side: 'incoming' });
        }
      } else if (!b) {
        // 本地新增步骤自动保留
        changes.push({ kind: 'step-added', label: labelOf(id), detail: trim(l.statement), side: 'local' });
      }
      // fallback 且 b 存在：本地已有步骤是共同内容，不允许导入侧反向删除
      return;
    }

    if (!l && r) {
      if (b && !fallback) {
        if (!scalarEqual(b, r)) {
          conflicts.push({ kind: 'step-delete-modified', id: `conf-step-del-${id}`, stepId: id, label: labelOf(id), deletedBy: 'local', kept: r, decided: null });
        } else {
          changes.push({ kind: 'step-removed', label: labelOf(id), detail: trim(b.statement), side: 'local' });
        }
      } else {
        // incoming 新增（合成基线下本地没有即非共同内容，照样收入）
        changes.push({ kind: 'step-added', label: labelOf(id), detail: trim(r.statement), side: 'incoming' });
      }
      return;
    }

    // 两侧都删（真实基线才可能出现）
    if (b && !fallback) {
      changes.push({ kind: 'step-removed', label: labelOf(id), detail: trim(b.statement), side: 'local' });
    }
  });

  /* ---- 步骤字段的自动接收清单（只改一处） ---- */
  allStepIds.forEach((id) => {
    const b = baseSteps.get(id);
    const l = localSteps.get(id);
    const r = incomingSteps.get(id);
    if (!l || !r || !b) return;
    if (conflicts.some((c) => c.kind === 'step-both-modified' && c.stepId === id)) return;
    SCALAR_FIELDS.forEach((field) => {
      if (l[field] === r[field]) return;
      if (b[field] === l[field]) {
        changes.push({ kind: 'step-field-changed', label: `${labelOf(id)} · ${FIELD_LABEL[field]}`, detail: `${trim(String(b[field]) || '空')} → ${trim(String(r[field]) || '空')}`, side: 'incoming' });
      } else if (b[field] === r[field]) {
        changes.push({ kind: 'step-field-changed', label: `${labelOf(id)} · ${FIELD_LABEL[field]}`, detail: `${trim(String(b[field]) || '空')} → ${trim(String(l[field]) || '空')}`, side: 'local' });
      }
    });
  });

  /* ---- 引用冲突：一侧撤去步骤，另一侧（基线之外）新增了对它的引用 ---- */
  const refConflictKeys = new Set<string>();
  allStepIds.forEach((targetId) => {
    const inLocal = localSteps.has(targetId);
    const inIncoming = incomingSteps.has(targetId);
    if (inLocal === inIncoming) return; // 两侧都在/都不在，不构成撞车

    // 合成基线下本地独有的步骤共同保留，不会被当作删除
    if (fallback && inLocal && !inIncoming) return;

    const deletedBy: 'local' | 'incoming' = inLocal ? 'incoming' : 'local';
    const addedBy: 'local' | 'incoming' = deletedBy === 'local' ? 'incoming' : 'local';
    const surviving = addedBy === 'local' ? localSteps : incomingSteps;
    const baseRefOwners = new Set(base.steps.filter((step) => step.references.includes(targetId)).map((step) => step.id));

    surviving.forEach((owner) => {
      if (!owner.references.includes(targetId)) return;
      if (baseRefOwners.has(owner.id)) return; // 基线已有引用走普通摘除，不算“新增引用撞车”
      const key = `${owner.id}>${targetId}`;
      refConflictKeys.add(key);
      conflicts.push({
        kind: 'ref-added-to-deleted',
        id: `conf-ref-${owner.id}-${targetId}`,
        ownerId: owner.id,
        ownerLabel: labelOf(owner.id),
        targetId,
        targetLabel: labelOf(targetId),
        addedBy,
        deletedBy,
        decided: null,
      });
    });
  });

  /* ---- 引用的自动变更清单 ---- */
  allStepIds.forEach((ownerId) => {
    const b = baseSteps.get(ownerId);
    const l = localSteps.get(ownerId);
    const r = incomingSteps.get(ownerId);
    const baseRefs = new Set(b?.references ?? []);
    const localRefs = new Set(l?.references ?? []);
    const incomingRefs = new Set(r?.references ?? []);
    const refs = new Set<string>([...baseRefs, ...localRefs, ...incomingRefs]);
    refs.forEach((targetId) => {
      const inB = baseRefs.has(targetId);
      const inL = localRefs.has(targetId);
      const inR = incomingRefs.has(targetId);
      if (inL === inR) return;
      if (refConflictKeys.has(`${ownerId}>${targetId}`)) return; // 撞车项已列入待处理
      if (!inB) {
        changes.push({ kind: 'ref-added', label: `${labelOf(ownerId)} → ${labelOf(targetId)}`, detail: '新增依据', side: inL ? 'local' : 'incoming' });
      } else {
        changes.push({ kind: 'ref-removed', label: `${labelOf(ownerId)} → ${labelOf(targetId)}`, detail: '摘除依据', side: !inL ? 'local' : 'incoming' });
      }
    });
  });

  /* ---- 符号表：同一基线三向合并 ---- */
  const symbolKeys = new Set<string>([...Object.keys(base.symbols), ...Object.keys(document.symbols), ...Object.keys(pkg.symbols)]);
  symbolKeys.forEach((key) => {
    const b = base.symbols[key];
    const l = document.symbols[key];
    const r = pkg.symbols[key];
    const hasB = key in base.symbols;
    const hasL = key in document.symbols;
    const hasR = key in pkg.symbols;

    if (hasL && hasR) {
      if (l === r) return;
      if (hasB && b !== l && b !== r) {
        conflicts.push({ kind: 'symbol-both-modified', id: `conf-sym-${key}`, key, local: l, incoming: r, base: b, decided: null });
      } else {
        // 只改一处：取相对基线发生变化的一侧（合成基线下即采用导入侧改动）
        const side: 'local' | 'incoming' = hasB && b === r ? 'local' : 'incoming';
        changes.push({ kind: 'symbol-changed', label: `符号 $${key}$`, detail: `${trim(hasB ? b : '空')} → ${trim(side === 'local' ? l : r)}`, side });
      }
      return;
    }

    if (hasL && !hasR) {
      if (hasB && !fallback) {
        if (b !== l) {
          conflicts.push({ kind: 'symbol-delete-modified', id: `conf-sym-del-${key}`, key, modifiedValue: l, deletedBy: 'incoming', decided: null });
        } else {
          changes.push({ kind: 'symbol-removed', label: `符号 $${key}$`, detail: trim(b), side: 'incoming' });
        }
      } else if (!hasB) {
        changes.push({ kind: 'symbol-added', label: `符号 $${key}$`, detail: trim(l), side: 'local' });
      }
      // fallback + hasB：本地已有符号作为共同内容保留
      return;
    }

    if (!hasL && hasR) {
      if (hasB && !fallback) {
        if (b !== r) {
          conflicts.push({ kind: 'symbol-delete-modified', id: `conf-sym-del-${key}`, key, modifiedValue: r, deletedBy: 'local', decided: null });
        } else {
          changes.push({ kind: 'symbol-removed', label: `符号 $${key}$`, detail: trim(b), side: 'local' });
        }
      } else {
        changes.push({ kind: 'symbol-added', label: `符号 $${key}$`, detail: trim(r), side: 'incoming' });
      }
    }
  });

  /* ---- 证明目标三向合并 ---- */
  if (document.goal !== pkg.goal) {
    if (base.goal !== document.goal && base.goal !== pkg.goal) {
      conflicts.push({ kind: 'goal-both-modified', id: 'conf-goal', local: document.goal, incoming: pkg.goal, decided: null });
    } else {
      const side: 'local' | 'incoming' = base.goal === document.goal ? 'incoming' : 'local';
      changes.push({ kind: 'goal-changed', label: '证明目标', detail: `→ ${trim(side === 'incoming' ? pkg.goal : document.goal)}`, side });
    }
  }

  const preview: MergePreview = { base, snapshot: pkg.snapshot, fallbackBase: fallback, conflicts, changes, merged: { goal: '', symbols: {}, steps: [] } };
  preview.merged = buildMerged(preview, document, pkg);
  return preview;
}

/* ------------------------------------------------------------------ */
/* 依据当前冲突处理结果构造合并文档                                        */
/* ------------------------------------------------------------------ */

export function buildMerged(preview: MergePreview, document: ProofDocument, pkg: BranchPackage): MergedDocument {
  const { base, fallbackBase: fallback } = preview;
  const localSteps = new Map(document.steps.map((step) => [step.id, step]));
  const incomingSteps = new Map(pkg.steps.map((step) => [step.id, step]));
  const baseSteps = new Map(base.steps.map((step) => [step.id, step]));

  const stepBothMap = new Map(preview.conflicts
    .filter((c): c is StepBothModifiedConflict => c.kind === 'step-both-modified')
    .map((c) => [c.stepId, c]));
  const stepDelMap = new Map(preview.conflicts
    .filter((c): c is StepDeleteModifiedConflict => c.kind === 'step-delete-modified')
    .map((c) => [c.stepId, c]));
  const symbolBothMap = new Map(preview.conflicts
    .filter((c): c is SymbolBothModifiedConflict => c.kind === 'symbol-both-modified')
    .map((c) => [c.key, c]));
  const symbolDelMap = new Map(preview.conflicts
    .filter((c): c is SymbolDeleteModifiedConflict => c.kind === 'symbol-delete-modified')
    .map((c) => [c.key, c]));
  const refConflictMap = new Map(preview.conflicts
    .filter((c): c is RefAddedToDeletedConflict => c.kind === 'ref-added-to-deleted')
    .map((c) => [`${c.ownerId}>${c.targetId}`, c]));

  /* 1) 步骤去留与字段取值 */
  const kept = new Map<string, ProofStep>();
  const stepIds = new Set<string>([...baseSteps.keys(), ...localSteps.keys(), ...incomingSteps.keys()]);

  stepIds.forEach((id) => {
    const b = baseSteps.get(id);
    const l = localSteps.get(id);
    const r = incomingSteps.get(id);

    if (l && r) {
      const both = stepBothMap.get(id);
      if (both?.decided === 'local') { kept.set(id, structuredClone(l)); return; }
      if (both?.decided === 'incoming') { kept.set(id, structuredClone(r)); return; }
      // 逐字段三向合并：两边都改且不同的字段是冲突字段，未决时先取本地占位
      const chosen = structuredClone(l);
      SCALAR_FIELDS.forEach((field) => {
        const lv = l[field];
        const rv = r[field];
        const bv = b?.[field];
        if (lv === rv) { chosen[field] = lv as never; return; }
        if (b && bv === lv) { chosen[field] = rv as never; return; }
        if (b && bv === rv) { chosen[field] = lv as never; return; }
        chosen[field] = lv as never;
      });
      kept.set(id, chosen);
      return;
    }

    if (l && !r) {
      const del = stepDelMap.get(id);
      if (del?.decided === 'delete') return;
      if (del) { kept.set(id, structuredClone(l)); return; } // restore 或未决
      if (b && !fallback) return; // incoming 单方删除，自动接收
      kept.set(id, structuredClone(l)); // 本地新增；fallback 共同内容保留
      return;
    }

    if (!l && r) {
      const del = stepDelMap.get(id);
      if (del?.decided === 'delete') return;
      if (del) { kept.set(id, structuredClone(r)); return; }
      if (b && !fallback) return; // local 单方删除
      kept.set(id, structuredClone(r)); // incoming 新增
    }
  });

  // “恢复依据”的决定要把一侧删掉的目标步骤从新增侧带回来
  preview.conflicts.forEach((conflict) => {
    if (conflict.kind !== 'ref-added-to-deleted' || conflict.decided !== 'restore') return;
    if (kept.has(conflict.targetId)) return;
    const source = conflict.addedBy === 'local' ? localSteps : incomingSteps;
    const revived = source.get(conflict.targetId);
    if (revived) kept.set(conflict.targetId, structuredClone(revived));
  });

  /* 2) 引用：集合三向合并；撞车的新增引用按决定处理；悬空引用绝不写入 */
  kept.forEach((step, id) => {
    const b = baseSteps.get(id);
    const l = localSteps.get(id);
    const r = incomingSteps.get(id);
    const baseRefs = new Set(b?.references ?? []);
    const localRefs = new Set(l?.references ?? []);
    const incomingRefs = new Set(r?.references ?? []);

    // 以两侧原顺序贴回，保持稳定步骤编号语义
    const ordered = [...(l?.references ?? []), ...(r?.references ?? [])].filter((ref, index, arr) => arr.indexOf(ref) === index);
    const result: string[] = [];

    ordered.forEach((targetId) => {
      const inB = baseRefs.has(targetId);
      const inL = localRefs.has(targetId);
      const inR = incomingRefs.has(targetId);

      if (inL && inR) { result.push(targetId); return; }
      if (!inL && !inR) return;

      if (inB) {
        // 基线已有引用：一侧摘除即相对基线发生变化 → 自动摘除（连带删除场景由此消化）
        return;
      }

      // 基线没有的新增引用
      const collision = refConflictMap.get(`${id}>${targetId}`);
      if (collision?.decided === 'drop') return;
      result.push(targetId); // 单方新增自动接收；撞车项未决时占位，pending 未清空无法确认
    });

    // 悬空引用保险：正式证明中不允许出现断掉的依据
    step.references = [...new Set(result)].filter((targetId) => kept.has(targetId));
  });

  /* 3) 排序：基线顺序为主，两侧新增步骤按 local 先、incoming 后追加 */
  const merged: ProofStep[] = [];
  const pushed = new Set<string>();
  base.steps.forEach((step) => {
    const alive = kept.get(step.id);
    if (alive) { merged.push(alive); pushed.add(step.id); }
  });
  document.steps.forEach((step) => {
    const alive = kept.get(step.id);
    if (alive && !pushed.has(step.id)) { merged.push(alive); pushed.add(step.id); }
  });
  pkg.steps.forEach((step) => {
    const alive = kept.get(step.id);
    if (alive && !pushed.has(step.id)) { merged.push(alive); pushed.add(step.id); }
  });

  /* 4) 符号表 */
  const symbols: Record<string, string> = {};
  const symbolKeys = new Set<string>([...Object.keys(base.symbols), ...Object.keys(document.symbols), ...Object.keys(pkg.symbols)]);
  symbolKeys.forEach((key) => {
    const b = base.symbols[key];
    const l = document.symbols[key];
    const r = pkg.symbols[key];
    const hasB = key in base.symbols;
    const hasL = key in document.symbols;
    const hasR = key in pkg.symbols;

    if (hasL && hasR) {
      if (l === r) { symbols[key] = l; return; }
      const both = symbolBothMap.get(key);
      if (both?.decided === 'local') { symbols[key] = l; return; }
      if (both?.decided === 'incoming') { symbols[key] = r; return; }
      if (hasB && b === l) symbols[key] = r;
      else if (hasB && b === r) symbols[key] = l;
      else symbols[key] = l; // 未决占位
      return;
    }

    if (hasL && !hasR) {
      const del = symbolDelMap.get(key);
      if (del?.decided === 'delete') return;
      if (del) { symbols[key] = l; return; } // restore 或未决
      if (hasB && !fallback) return; // incoming 单方删除
      symbols[key] = l;
      return;
    }

    if (!hasL && hasR) {
      const del = symbolDelMap.get(key);
      if (del?.decided === 'delete') return;
      if (del) { symbols[key] = r; return; }
      if (hasB && !fallback) return;
      symbols[key] = r;
    }
  });

  /* 5) 证明目标 */
  let goal = document.goal;
  const goalConflict = preview.conflicts.find((c): c is GoalBothModifiedConflict => c.kind === 'goal-both-modified');
  if (document.goal === pkg.goal) goal = document.goal;
  else if (goalConflict?.decided === 'incoming') goal = pkg.goal;
  else if (goalConflict?.decided === 'local') goal = document.goal;
  else if (base.goal === document.goal) goal = pkg.goal;
  else if (base.goal === pkg.goal) goal = document.goal;

  return { goal, symbols, steps: merged };
}

/* ------------------------------------------------------------------ */
/* 待处理项判定                                                          */
/* ------------------------------------------------------------------ */

export function pendingConflicts(preview: MergePreview): MergeConflict[] {
  const stepMap = new Map(preview.merged.steps.map((step) => [step.id, step]));
  const deleteConflicts = new Map(preview.conflicts
    .filter((c): c is StepDeleteModifiedConflict => c.kind === 'step-delete-modified')
    .map((c) => [c.stepId, c]));
  return preview.conflicts.filter((conflict) => {
    if (conflict.kind === 'ref-added-to-deleted') {
      // 引用方步骤已被明确删除（删改冲突选了删除）→ 冲突随步骤一起消解
      if (deleteConflicts.get(conflict.ownerId)?.decided === 'delete') return false;
      // 引用方不在合并结果中（单方删除自动接收）→ 同样消解
      if (!stepMap.has(conflict.ownerId)) return false;
      return conflict.decided === null;
    }
    return conflict.decided === null;
  });
}

/* ------------------------------------------------------------------ */
/* 导出包                                                                */
/* ------------------------------------------------------------------ */

export function createBranchPackage(document: ProofDocument, source: string): { pkg: BranchPackage; snapshot: BranchSnapshot } {
  const snapshot: BranchSnapshot = {
    id: uid('snap'),
    name: `分支快照 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    createdAt: new Date().toISOString(),
    exportedFrom: document.id,
    goal: document.goal,
    symbols: structuredClone(document.symbols),
    steps: structuredClone(document.steps),
  };
  return {
    snapshot,
    pkg: {
      format: BRANCH_PACKAGE_FORMAT,
      documentId: document.id,
      documentTitle: document.title,
      source,
      exportedAt: snapshot.createdAt,
      snapshot,
      goal: document.goal,
      symbols: structuredClone(document.symbols),
      steps: structuredClone(document.steps),
    },
  };
}
