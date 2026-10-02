import type {
  MergeGoalStatus,
  MergePending,
  MergeResolution,
  MergeStepStatus,
  MergeSymbolStatus,
  ProofBundle,
  ProofDocument,
  ProofStep,
  ProofVersion,
} from './types';

/**
 * 离线分支合并（三方合并）
 *
 * base = 导出时留下的版本快照；local = 当前文档；incoming = 导入包。
 * 步骤以稳定编号 key 对齐，与排列顺序无关。
 * - 只有一侧相对基线改动：自动接收；
 * - 两侧都改同一处：列为待处理，由人工裁决；
 * - 一侧删除、另一侧改动或新增引用：列为待处理，绝不产生断掉的依据；
 * - 没有基线快照的旧包：把双方完全一致的内容当作共同基线。
 */

export interface SideStepInfo {
  step: ProofStep | undefined;
  hash: string | undefined;
}

export interface MergeStepRow {
  key: string;
  status: MergeStepStatus;
  local: ProofStep | undefined;
  incoming: ProofStep | undefined;
}

interface Side {
  steps: Map<string, ProofStep>;
  order: string[];
  idToKey: Map<string, string>;
}

const STEP_FIELDS: (keyof ProofStep)[] = ['type', 'statement', 'rule', 'references', 'note', 'counterexample', 'alternative'];

function sideRefTokens(step: ProofStep, side: Side): string[] {
  return step.references.map((id) => side.idToKey.get(id) ?? id);
}

function hashStep(step: ProofStep | undefined, refs: string[]): string | undefined {
  if (!step) return undefined;
  const body = STEP_FIELDS.filter((field) => field !== 'references')
    .map((field) => String(step[field]))
    .join('\u0001');
  return `${body}\u0001${[...new Set(refs)].sort().join(',')}`;
}

function buildSide(steps: ProofStep[]): Side {
  const map = new Map<string, ProofStep>();
  const idToKey = new Map<string, string>();
  const order: string[] = [];
  steps.forEach((step) => {
    if (!step.key || map.has(step.key)) return;
    map.set(step.key, step);
    idToKey.set(step.id, step.key);
    order.push(step.key);
  });
  return { steps: map, order, idToKey };
}

/** 解析并补全导入包；缺少稳定编号的旧稿按顺序补发，编号不与包内既有编号冲突 */
export function normalizeBundle(raw: ProofBundle): ProofBundle {
  const bundle: ProofBundle = structuredClone(raw);
  bundle.format = 'sologsb-proof-bundle';
  bundle.version = 1;
  bundle.steps ??= [];
  bundle.symbols ??= {};
  bundle.versions ??= [];
  bundle.goal ??= '';
  bundle.baselineId ??= null;
  let seq = Math.max(0, bundle.stepSeq ?? 0);
  const used = new Set<string>();
  bundle.steps.forEach((step) => {
    if (!step.key) {
      do {
        seq += 1;
        step.key = `S${seq}`;
      } while (used.has(step.key));
    }
    used.add(step.key);
    ['note', 'counterexample', 'alternative'].forEach((field) => {
      if (typeof (step as unknown as Record<string, unknown>)[field] !== 'string') {
        (step as unknown as Record<string, string>)[field] = '';
      }
    });
    step.references ??= [];
  });
  bundle.stepSeq = Math.max(seq, ...[...used].map((key) => Number(key.slice(1)) || 0), 0);
  bundle.versions.forEach((version) => {
    version.symbols ??= {};
  });
  return bundle;
}

export class MergeSession {
  readonly legacy: boolean;
  readonly baselineId: string | null;
  readonly localSide: Side;
  readonly incomingSide: Side;
  readonly baseSide: Side;
  readonly baseGoal: string | null;
  readonly baseSymbols: Record<string, string>;
  readonly baseVersions: ProofVersion[];
  readonly stepRows: MergeStepRow[] = [];
  readonly stepStatus = new Map<string, MergeStepStatus>();
  readonly symbolStatus = new Map<string, MergeSymbolStatus>();
  readonly goalStatus: MergeGoalStatus;
  readonly stepOrder: string[] = [];
  readonly symbolOrder: string[] = [];
  readonly incoming: ProofBundle;
  readonly localGoal: string;
  readonly localSymbols: Record<string, string>;

  constructor(local: ProofDocument, incoming: ProofBundle) {
    this.incoming = incoming;
    this.localGoal = local.goal;
    this.localSymbols = { ...local.symbols };
    this.localSide = buildSide(local.steps);
    this.incomingSide = buildSide(incoming.steps);
    const baseline = incoming.baselineId
      ? incoming.versions.find((version) => version.id === incoming.baselineId)
      : undefined;
    this.legacy = !baseline;
    this.baselineId = baseline?.id ?? null;
    this.baseVersions = incoming.versions;

    if (baseline) {
      this.baseSide = buildSide(baseline.steps);
      this.baseGoal = baseline.goal;
      this.baseSymbols = { ...baseline.symbols };
    } else {
      // 旧稿没有快照：双方逐字一致的步骤/符号才视为共同内容
      const commonSteps = local.steps.filter((localStep) => {
        const other = incoming.steps.find((candidate) => candidate.key === localStep.key);
        return other && hashStep(localStep, sideRefTokens(localStep, this.localSide)) === hashStep(other, sideRefTokens(other, this.incomingSide));
      });
      this.baseSide = buildSide(commonSteps);
      this.baseGoal = local.goal === incoming.goal ? local.goal : null;
      this.baseSymbols = Object.fromEntries(
        Object.entries(local.symbols).filter(([key, value]) => incoming.symbols[key] === value),
      );
    }

    this.buildStepRows();
    this.goalStatus = this.computeGoalStatus(local.goal, incoming.goal);
    this.buildSymbolRows(local.symbols, incoming.symbols);
    this.stepOrder = this.computeOrder(this.localSide.order, this.incomingSide.order);
    this.symbolOrder = this.computeOrder(Object.keys(local.symbols), Object.keys(incoming.symbols));
  }

  private buildStepRows(): void {
    const keys = new Set<string>([
      ...this.baseSide.steps.keys(),
      ...this.localSide.steps.keys(),
      ...this.incomingSide.steps.keys(),
    ]);
    keys.forEach((key) => {
      const local = this.localSide.steps.get(key);
      const incoming = this.incomingSide.steps.get(key);
      const inBase = this.baseSide.steps.has(key);
      let status: MergeStepStatus;
      if (local && incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        if (hl === hi) status = 'unchanged';
        else if (!inBase || hb === undefined) status = 'changed-both';
        else if (hl === hb) status = 'changed-incoming';
        else if (hi === hb) status = 'changed-local';
        else status = 'changed-both';
      } else if (local) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        status = inBase && hb !== undefined && hl !== hb ? 'changed-local-deleted-incoming' : 'deleted-incoming';
        if (!inBase) status = 'local-only';
      } else if (incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        status = inBase && hb !== undefined && hi !== hb ? 'deleted-local-changed-incoming' : 'deleted-local';
        if (!inBase) status = 'incoming-only';
      } else {
        return; // 两侧都已删除
      }
      this.stepStatus.set(key, status);
      this.stepRows.push({ key, status, local, incoming });
    });
  }

  private computeGoalStatus(localGoal: string, incomingGoal: string): MergeGoalStatus {
    if (localGoal === incomingGoal) return 'unchanged';
    if (this.baseGoal === null) return 'changed-both';
    if (localGoal === this.baseGoal) return 'changed-incoming';
    if (incomingGoal === this.baseGoal) return 'changed-local';
    return 'changed-both';
  }

  private buildSymbolRows(localSymbols: Record<string, string>, incomingSymbols: Record<string, string>): void {
    const keys = new Set<string>([...Object.keys(this.baseSymbols), ...Object.keys(localSymbols), ...Object.keys(incomingSymbols)]);
    keys.forEach((key) => {
      const local = localSymbols[key];
      const incoming = incomingSymbols[key];
      const base = this.baseSymbols[key];
      const localExists = key in localSymbols;
      const incomingExists = key in incomingSymbols;
      let status: MergeSymbolStatus;
      if (localExists && incomingExists) {
        if (local === incoming) status = 'unchanged';
        else if (!(key in this.baseSymbols)) status = 'changed-both';
        else if (local === base) status = 'changed-incoming';
        else if (incoming === base) status = 'changed-local';
        else status = 'changed-both';
      } else if (localExists) {
        status = key in this.baseSymbols && local !== base ? 'changed-local-deleted-incoming' : 'deleted-incoming';
        if (!(key in this.baseSymbols)) status = 'local-only';
      } else if (incomingExists) {
        status = key in this.baseSymbols && incoming !== base ? 'deleted-local-changed-incoming' : 'deleted-local';
        if (!(key in this.baseSymbols)) status = 'incoming-only';
      } else {
        return;
      }
      this.symbolStatus.set(key, status);
    });
  }

  /** 以本地顺序为基线，把另一侧独有步骤按相邻锚点插入；纯删除不留空 */
  private computeOrder(localOrder: string[], incomingOrder: string[]): string[] {
    const ordered = [...localOrder];
    const present = new Set(ordered);
    incomingOrder.forEach((key) => {
      if (present.has(key)) return;
      const index = incomingOrder.indexOf(key);
      let anchor = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        anchor = ordered.indexOf(incomingOrder[i]);
        if (anchor >= 0) break;
      }
      if (anchor >= 0) {
        ordered.splice(anchor + 1, 0, key);
      } else {
        let nextAnchor = -1;
        for (let i = index + 1; i < incomingOrder.length; i += 1) {
          nextAnchor = ordered.indexOf(incomingOrder[i]);
          if (nextAnchor >= 0) break;
        }
        if (nextAnchor >= 0) ordered.splice(nextAnchor, 0, key);
        else ordered.push(key);
      }
      present.add(key);
    });
    return ordered;
  }

  /** 合并后仍保留的步骤编号 */
  survivingKeys(resolutions: Map<string, MergeResolution>): Set<string> {
    const forced = new Set<string>();
    // dangling 裁决为“保留依据”时，被删步骤随之恢复
    resolutions.forEach((value, id) => {
      if (id.startsWith('dangling:') && value === 'keep') forced.add(id.split(':')[2]);
    });
    const result = new Set<string>();
    this.stepStatus.forEach((status, key) => {
      switch (status) {
        case 'unchanged':
        case 'changed-local':
        case 'changed-incoming':
        case 'changed-both':
        case 'local-only':
        case 'incoming-only':
          result.add(key);
          break;
        case 'deleted-local':
        case 'deleted-incoming':
          if (forced.has(key)) result.add(key);
          break;
        case 'changed-local-deleted-incoming':
        case 'deleted-local-changed-incoming':
          if (resolutions.get(`moddelete-step:${key}`) === 'keep' || forced.has(key)) result.add(key);
          break;
      }
    });
    return result;
  }

  /** 当前裁决下每个保留步骤实际采用的版本（local / incoming） */
  chosenSteps(
    resolutions: Map<string, MergeResolution>,
  ): { key: string; origin: 'local' | 'incoming'; step: ProofStep }[] {
    const alive = this.survivingKeys(resolutions);
    return this.stepOrder
      .filter((key) => alive.has(key))
      .map((key) => {
        const status = this.stepStatus.get(key)!;
        const local = this.localSide.steps.get(key);
        const incoming = this.incomingSide.steps.get(key);
        let origin: 'local' | 'incoming';
        switch (status) {
          case 'changed-incoming':
          case 'incoming-only':
          case 'deleted-local-changed-incoming':
            origin = 'incoming';
            break;
          case 'changed-local':
          case 'local-only':
          case 'changed-local-deleted-incoming':
            origin = 'local';
            break;
          case 'changed-both':
            origin = resolutions.get(`step:${key}`) === 'keep-incoming' ? 'incoming' : 'local';
            break;
          default:
            origin = local ? 'local' : 'incoming';
        }
        const step = (origin === 'local' ? local : incoming) ?? local ?? incoming;
        return { key, origin, step: step! };
      });
  }

  chosenGoal(resolutions: Map<string, MergeResolution>): string {
    switch (this.goalStatus) {
      case 'changed-incoming':
        return this.incoming.goal;
      case 'changed-local':
        return this.localGoal;
      case 'changed-both':
        return resolutions.get('goal') === 'keep-incoming' ? this.incoming.goal : this.localGoal;
      default:
        return this.localGoal || this.incoming.goal;
    }
  }

  chosenSymbols(resolutions: Map<string, MergeResolution>): Record<string, string> {
    const result: Record<string, string> = {};
    const localSymbols = this.localSymbols;
    this.symbolOrder.forEach((key) => {
      const status = this.symbolStatus.get(key)!;
      const localExists = key in localSymbols;
      const incomingExists = key in this.incoming.symbols;
      const decision = resolutions.get(`moddelete-symbol:${key}`) ?? resolutions.get(`symbol:${key}`);
      switch (status) {
        case 'unchanged':
        case 'changed-local':
        case 'local-only':
          if (localExists) result[key] = localSymbols[key];
          break;
        case 'changed-incoming':
        case 'incoming-only':
          if (incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case 'changed-both':
          if (decision === 'keep-incoming' && incomingExists) result[key] = this.incoming.symbols[key];
          else if (localExists) result[key] = localSymbols[key];
          break;
        case 'changed-local-deleted-incoming':
          if (decision !== 'delete' && localExists) result[key] = localSymbols[key];
          break;
        case 'deleted-local-changed-incoming':
          if (decision === 'keep' && incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case 'deleted-local':
        case 'deleted-incoming':
          break;
      }
    });
    return result;
  }

  /** 引用边：from → 引用目标编号；含相对基线的新旧与来源侧标记 */
  private effectiveEdges(
    resolutions: Map<string, MergeResolution>,
  ): { from: string; to: string; isNew: boolean; inLocal: boolean; inIncoming: boolean }[] {
    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));
    const edges: { from: string; to: string; isNew: boolean; inLocal: boolean; inIncoming: boolean }[] = [];
    chosen.forEach(({ key, origin, step }) => {
      const side = origin === 'local' ? this.localSide : this.incomingSide;
      const tokens = sideRefTokens(step, side);
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : new Set<string>();
      tokens.forEach((to) => {
        if (!alive.has(to)) {
          // 合并前就游离的旧引用（双方都没有该步骤）原样保留；
          // 已知但被删除的步骤：base 中既有的旧引用随删除清理，新增引用在 listPending 中拦截
          if (this.isKnownKey(to)) return;
        }
        const localStep = this.localSide.steps.get(key);
        const incomingStep = this.incomingSide.steps.get(key);
        edges.push({
          from: key,
          to,
          isNew: !baseTokens.has(to),
          inLocal: !!localStep && sideRefTokens(localStep, this.localSide).includes(to),
          inIncoming: !!incomingStep && sideRefTokens(incomingStep, this.incomingSide).includes(to),
        });
      });
    });
    return edges;
  }

  private isKnownKey(token: string): boolean {
    return (
      this.localSide.steps.has(token) ||
      this.incomingSide.steps.has(token) ||
      this.baseSide.steps.has(token)
    );
  }

  /** 当前裁决下仍需人工处理的条目 */
  listPending(resolutions: Map<string, MergeResolution>): MergePending[] {
    const pending: MergePending[] = [];
    this.stepRows.forEach(({ key, status, local, incoming }) => {
      if (status === 'changed-both' && !resolutions.get(`step:${key}`)) {
        pending.push({
          id: `step:${key}`,
          kind: 'step',
          stepKey: key,
          localSummary: local?.statement ?? '',
          incomingSummary: incoming?.statement ?? '',
        });
      }
      if (
        (status === 'changed-local-deleted-incoming' || status === 'deleted-local-changed-incoming') &&
        !resolutions.get(`moddelete-step:${key}`) &&
        !this.danglingKeepFor(key, resolutions)
      ) {
        const changed = status === 'changed-local-deleted-incoming' ? local! : incoming!;
        pending.push({
          id: `moddelete-step:${key}`,
          kind: 'step-moddelete',
          stepKey: key,
          localSummary: status === 'changed-local-deleted-incoming' ? changed.statement : '（本地已删除该步骤）',
          incomingSummary: status === 'deleted-local-changed-incoming' ? changed.statement : '（导入侧已删除该步骤）',
        });
      }
    });

    if (this.goalStatus === 'changed-both' && !resolutions.get('goal')) {
      pending.push({ id: 'goal', kind: 'goal', localSummary: this.localGoal, incomingSummary: this.incoming.goal });
    }

    this.symbolStatus.forEach((status, key) => {
      if (status === 'changed-both' && !resolutions.get(`symbol:${key}`)) {
        pending.push({
          id: `symbol:${key}`,
          kind: 'symbol',
          symbol: key,
          localSummary: this.localSymbols[key] ?? '',
          incomingSummary: this.incoming.symbols[key] ?? '',
        });
      }
      if (
        (status === 'changed-local-deleted-incoming' || status === 'deleted-local-changed-incoming') &&
        !resolutions.get(`moddelete-symbol:${key}`)
      ) {
        pending.push({
          id: `moddelete-symbol:${key}`,
          kind: 'symbol-moddelete',
          symbol: key,
          localSummary: status === 'changed-local-deleted-incoming' ? this.localSymbols[key] : '（本地已删除）',
          incomingSummary: status === 'deleted-local-changed-incoming' ? this.incoming.symbols[key] : '（导入侧已删除）',
        });
      }
    });

    // 一侧删去步骤、另一侧“新增”引用它：必须先裁决，正式证明不允许断掉的依据
    const alive = this.survivingKeys(resolutions);
    this.chosenSteps(resolutions).forEach(({ key, origin, step }) => {
      const side = origin === 'local' ? this.localSide : this.incomingSide;
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : new Set<string>();
      sideRefTokens(step, side).forEach((to) => {
        if (alive.has(to) || !this.isKnownKey(to) || baseTokens.has(to)) return;
        const id = `dangling:${key}:${to}`;
        if (resolutions.has(id)) return;
        const targetStatus = this.stepStatus.get(to);
        pending.push({
          id,
          kind: 'dangling',
          stepKey: to,
          referrerKeys: [key],
          targetKey: to,
          localSummary: `步骤 ${key} 仍需引用 ${to}（${targetStatus === 'deleted-local' ? '本地已删除' : '导入侧已删除'}）`,
          incomingSummary: '保留该步骤并恢复依据，或从此步删去这条引用',
        });
      });
    });

    // 新增边成环时要求断开一侧
    const cycleEdges = this.cyclicNewEdges(resolutions);
    if (cycleEdges.size && !resolutions.get('cycle')) {
      const nodes = new Set<string>();
      cycleEdges.forEach((edge) => {
        const [from, to] = edge.split('→');
        nodes.add(from);
        nodes.add(to);
      });
      pending.push({
        id: 'cycle',
        kind: 'cycle',
        referrerKeys: [...nodes],
        localSummary: '两侧新增的引用形成闭环',
        incomingSummary: `涉及步骤：${[...nodes].join('、')}`,
      });
    }

    return pending;
  }

  private danglingKeepFor(target: string, resolutions: Map<string, MergeResolution>): boolean {
    let found = false;
    resolutions.forEach((value, id) => {
      if (id.startsWith('dangling:') && id.endsWith(`:${target}`) && value === 'keep') found = true;
    });
    return found;
  }

  private cyclicNewEdges(resolutions: Map<string, MergeResolution>): Set<string> {
    const edges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew && this.survivingKeys(resolutions).has(edge.to));
    return cyclicEdges(edges.map((edge) => [edge.from, edge.to]));
  }

  /**
   * 生成合并后的完整文档。
   * 仍有未裁决条目时抛错——调用方据此保证“中途失败不写入任何内容”。
   */
  buildMerged(
    local: ProofDocument,
    resolutions: Map<string, MergeResolution>,
    createId: (prefix: string) => string,
    nowIso: string,
  ): ProofDocument {
    const unresolved = this.listPending(resolutions);
    if (unresolved.length) {
      throw new Error(`还有 ${unresolved.length} 项待处理，无法确认合并`);
    }

    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));

    // 成环新增引用按裁决断开
    const droppedEdges = new Set<string>();
    const cycleDecision = resolutions.get('cycle');
    if (cycleDecision) {
      const allEdges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew);
      let candidates = allEdges.filter((edge) =>
        cycleDecision === 'break-local' ? edge.inLocal && !edge.inIncoming : edge.inIncoming && !edge.inLocal,
      );
      let cyclic = cyclicEdges(
        allEdges
          .filter((edge) => alive.has(edge.to))
          .map((edge) => [edge.from, edge.to]),
      );
      candidates.forEach((edge) => {
        if (cyclic.has(`${edge.from}→${edge.to}`)) droppedEdges.add(`${edge.from}→${edge.to}`);
      });
      const stillCyclic = (): Set<string> =>
        cyclicEdges(
          allEdges
            .filter((edge) => alive.has(edge.to) && !droppedEdges.has(`${edge.from}→${edge.to}`))
            .map((edge) => [edge.from, edge.to]),
        );
      cyclic = stillCyclic();
      if (cyclic.size) {
        allEdges
          .filter(
            (edge) =>
              cycleDecision === 'break-local' ? edge.inLocal : edge.inIncoming,
          )
          .forEach((edge) => {
            if (cyclic.has(`${edge.from}→${edge.to}`)) droppedEdges.add(`${edge.from}→${edge.to}`);
            cyclic = stillCyclic();
          });
      }
    }

    // 重新分配 id，避免两台机器各自生成的 id 撞车；同时建立 编号→新id 映射
    const keyToMergedId = new Map<string, string>();
    const usedIds = new Set<string>();
    chosen.forEach(({ key, step }) => {
      let id = step.id;
      if (usedIds.has(id)) id = createId('step');
      usedIds.add(id);
      keyToMergedId.set(key, id);
    });

    const steps: ProofStep[] = chosen.map(({ key, origin, step }) => {
      const side = origin === 'local' ? this.localSide : this.incomingSide;
      const references: string[] = [];
      sideRefTokens(step, side).forEach((token, index) => {
        if (droppedEdges.has(`${key}→${token}`)) return;
        if (resolutions.get(`dangling:${key}:${token}`) === 'delete') return;
        if (keyToMergedId.has(token)) references.push(keyToMergedId.get(token)!);
        else if (!this.isKnownKey(token)) references.push(step.references[index] ?? token); // 合并前就游离的旧引用原样保留
        // 已知但已删除目标的引用：base 中既有的旧引用随删除清理，新引用已在待处理中拦截
      });
      return { ...structuredClone(step), id: keyToMergedId.get(key)!, references: [...new Set(references)] };
    });

    // 旧快照按 id 去重合并，按时间倒序排列；基线快照来自导入包，必然包含在内
    const versionMap = new Map<string, ProofVersion>();
    [...local.versions, ...this.baseVersions].forEach((version) => {
      if (!versionMap.has(version.id)) versionMap.set(version.id, structuredClone(version));
    });
    const versions = [...versionMap.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const maxKeySeq = Math.max(0, ...[...keyToMergedId.keys()].map((key) => Number(key.slice(1)) || 0));

    return {
      ...structuredClone(local),
      goal: this.chosenGoal(resolutions),
      symbols: this.chosenSymbols(resolutions),
      steps,
      versions,
      stepSeq: Math.max(local.stepSeq ?? 0, this.incoming.stepSeq ?? 0, maxKeySeq),
      updatedAt: nowIso,
    };
  }
}

/** Tarjan SCC：返回处于环上的边（同一强连通分量内部的边，含自环） */
function cyclicEdges(edges: [string, string][]): Set<string> {
  const graph = new Map<string, string[]>();
  edges.forEach(([from, to]) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push(to);
    if (!graph.has(to)) graph.set(to, []);
  });
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const component = new Map<string, number>();
  let componentCount = 0;

  const strongConnect = (node: string): void => {
    indices.set(node, index);
    low.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    (graph.get(node) ?? []).forEach((next) => {
      if (!indices.has(next)) {
        strongConnect(next);
        low.set(node, Math.min(low.get(node)!, low.get(next)!));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node)!, indices.get(next)!));
      }
    });
    if (low.get(node) === indices.get(node)) {
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.set(member, componentCount);
      } while (member !== node);
      componentCount += 1;
    }
  };
  graph.forEach((_, node) => {
    if (!indices.has(node)) strongConnect(node);
  });

  // 统计每个分量的节点数，单节点分量仅在有自环时算环
  const componentSize = new Map<number, number>();
  component.forEach((c) => componentSize.set(c, (componentSize.get(c) ?? 0) + 1));
  const result = new Set<string>();
  edges.forEach(([from, to]) => {
    const c = component.get(from)!;
    if (component.get(to) === c && (from === to || (componentSize.get(c) ?? 0) > 1)) {
      result.add(`${from}→${to}`);
    }
  });
  return result;
}

export function createMergeSession(local: ProofDocument, bundle: ProofBundle): MergeSession {
  return new MergeSession(local, normalizeBundle(bundle));
}

/** 导出交换包：先固化基线快照，再打包当前内容与全部旧快照 */
export function buildBundle(
  document: ProofDocument,
  baseline: ProofVersion,
  nowIso: string,
): ProofBundle {
  return {
    format: 'sologsb-proof-bundle',
    version: 1,
    exportedAt: nowIso,
    docId: document.id,
    title: document.title,
    baselineId: baseline.id,
    steps: structuredClone(document.steps),
    goal: document.goal,
    symbols: structuredClone(document.symbols),
    stepSeq: document.stepSeq,
    versions: structuredClone(document.versions),
  };
}
