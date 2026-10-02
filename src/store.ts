import { redraw } from 'mithril';
import type { BranchPackage, ProofCheck, ProofDocument, ProofStep, ProofVersion } from './types';
import {
  buildMerged,
  createBranchPackage,
  isBranchPackage,
  pendingConflicts,
  planMerge,
  type MergeConflict,
  type MergePreview,
} from './merge';

const STORAGE_KEY = 'sologsb-1014-proof-workspace-v1';
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T>(value: T): T => structuredClone(value);

export const RULES = ['前提', '定义展开', '代入', '等式变形', '分配律', '同类项合并', '数学归纳', '反证法', '构造法', '结论'];

function sampleSteps(): ProofStep[] {
  return [
    { id: 's1', type: 'premise', statement: '$a,b$ 是实数', rule: '前提', references: [], note: '采用实数域中的交换律与分配律。', counterexample: '', alternative: '' },
    { id: 's2', type: 'derivation', statement: '$(a+b)^2=(a+b)(a+b)$', rule: '定义展开', references: ['s1'], note: '把平方写成两个相同因式之积。', counterexample: '', alternative: '' },
    { id: 's3', type: 'derivation', statement: '$(a+b)(a+b)=a^2+ab+ba+b^2$', rule: '分配律', references: ['s2'], note: '', counterexample: '', alternative: '也可先展开后半部分。' },
    { id: 's4', type: 'derivation', statement: '$a^2+ab+ba+b^2=a^2+2ab+b^2$', rule: '同类项合并', references: ['s3'], note: '由实数的交换律，$ab=ba$。', counterexample: '', alternative: '' },
    { id: 's5', type: 'goal', statement: '$(a+b)^2=a^2+2ab+b^2$', rule: '结论', references: ['s4'], note: '目标已由步骤 1 至 4 逐项推出。', counterexample: '', alternative: '' },
  ];
}

function issueSteps(): ProofStep[] {
  return [
    { id: 'i1', type: 'premise', statement: '$n$ 是正整数', rule: '前提', references: [], note: '', counterexample: '', alternative: '' },
    { id: 'i2', type: 'derivation', statement: '$P(1)$ 成立', rule: '前提', references: ['i1'], note: '归纳基例。', counterexample: '', alternative: '' },
    { id: 'i3', type: 'derivation', statement: '若 $P(k)$ 成立，则 $P(k+1)$ 也成立', rule: '数学归纳', references: ['missing-step'], note: '这里故意保留一个失效引用，用于演示检查。', counterexample: '', alternative: '' },
    { id: 'i4', type: 'goal', statement: '$P(n)$ 对所有正整数 $n$ 成立', rule: '结论', references: ['i3'], note: '尚未补齐归纳假设。', counterexample: '', alternative: '' },
  ];
}

function initialDocuments(): ProofDocument[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'doc-algebra',
      title: '完全平方公式证明',
      author: '数学组',
      goal: '$(a+b)^2=a^2+2ab+b^2$',
      symbols: { a: '实数', b: '实数', P: '关于正整数的命题', n: '正整数', k: '正整数' },
      steps: sampleSteps(),
      versions: [],
      branchSnapshots: [],
      updatedAt: now,
    },
    {
      id: 'doc-induction',
      title: '数学归纳法待核对稿',
      author: '学生工作区',
      goal: '$P(n)$ 对所有正整数 $n$ 成立',
      symbols: { P: '关于正整数的命题', n: '正整数', k: '正整数' },
      steps: issueSteps(),
      versions: [],
      branchSnapshots: [],
      updatedAt: now,
    },
  ];
}

function loadDocuments(): ProofDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialDocuments();
    const parsed = JSON.parse(raw) as ProofDocument[];
    if (!Array.isArray(parsed) || !parsed.length) return initialDocuments();
    // 旧版数据迁移：补充分支快照字段
    parsed.forEach((document) => {
      if (!Array.isArray(document.branchSnapshots)) document.branchSnapshots = [];
    });
    return parsed;
  } catch {
    return initialDocuments();
  }
}

export class ProofStore {
  documents = loadDocuments();
  activeId = this.documents[0]?.id ?? '';
  selectedStepId = this.documents[0]?.steps[0]?.id ?? '';
  compareVersionId = '';
  dragStepId = '';
  lastInput: HTMLTextAreaElement | HTMLInputElement | null = null;
  undoStack: ProofDocument[][] = [];
  redoStack: ProofDocument[][] = [];
  toast = '';

  get current(): ProofDocument {
    return this.documents.find((item) => item.id === this.activeId) ?? this.documents[0];
  }

  get selectedStep(): ProofStep | undefined {
    return this.current?.steps.find((step) => step.id === this.selectedStepId);
  }

  get checks(): ProofCheck[] {
    if (!this.current) return [];
    return validate(this.current);
  }

  save(): void {
    this.current.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
  }

  update(mutator: (document: ProofDocument) => void): void {
    this.undoStack.push(clone(this.documents));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    mutator(this.current);
    this.save();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(clone(this.documents));
    this.documents = previous;
    this.ensureSelection();
    this.save();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.documents));
    this.documents = next;
    this.ensureSelection();
    this.save();
  }

  selectDocument(id: string): void {
    this.activeId = id;
    this.compareVersionId = '';
    this.selectedStepId = this.current?.steps[0]?.id ?? '';
  }

  selectStep(id: string): void {
    this.selectedStepId = id;
  }

  ensureSelection(): void {
    if (!this.documents.some((item) => item.id === this.activeId)) this.activeId = this.documents[0]?.id ?? '';
    if (!this.current?.steps.some((step) => step.id === this.selectedStepId)) {
      this.selectedStepId = this.current?.steps[0]?.id ?? '';
    }
  }

  addDocument(): void {
    const id = uid('doc');
    const document: ProofDocument = {
      id,
      title: '未命名证明',
      author: '本地用户',
      goal: '$A=B$',
      symbols: { A: '待定义对象', B: '待定义对象' },
      steps: [{ id: uid('step'), type: 'premise', statement: '在这里输入前提', rule: '前提', references: [], note: '', counterexample: '', alternative: '' }],
      versions: [],
      branchSnapshots: [],
      updatedAt: new Date().toISOString(),
    };
    this.undoStack.push(clone(this.documents));
    this.documents.unshift(document);
    this.activeId = id;
    this.selectedStepId = document.steps[0].id;
    this.save();
  }

  removeDocument(id: string): void {
    if (this.documents.length <= 1) {
      this.notify('至少保留一个证明文档');
      return;
    }
    this.undoStack.push(clone(this.documents));
    this.documents = this.documents.filter((item) => item.id !== id);
    this.ensureSelection();
    this.save();
  }

  addStep(type: ProofStep['type'] = 'derivation'): void {
    const step: ProofStep = {
      id: uid('step'),
      type,
      statement: type === 'goal' ? '$A=B$' : '输入新的推导式',
      rule: type === 'goal' ? '结论' : '等式变形',
      references: this.selectedStepId ? [this.selectedStepId] : [],
      note: '',
      counterexample: '',
      alternative: '',
    };
    this.update((document) => {
      const selectedIndex = document.steps.findIndex((item) => item.id === this.selectedStepId);
      document.steps.splice(type === 'goal' ? document.steps.length : selectedIndex + 1, 0, step);
    });
    this.selectedStepId = step.id;
  }

  removeStep(id: string): void {
    this.update((document) => {
      document.steps = document.steps.filter((step) => step.id !== id);
      document.steps.forEach((step) => {
        step.references = step.references.filter((reference) => reference !== id);
      });
    });
    this.ensureSelection();
  }

  moveStep(sourceId: string, targetId: string): void {
    if (sourceId === targetId) return;
    this.update((document) => {
      const from = document.steps.findIndex((step) => step.id === sourceId);
      const to = document.steps.findIndex((step) => step.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = document.steps.splice(from, 1);
      document.steps.splice(to, 0, moved);
    });
  }

  updateStep(patch: Partial<ProofStep>): void {
    const id = this.selectedStepId;
    this.update((document) => {
      const step = document.steps.find((item) => item.id === id);
      if (step) Object.assign(step, patch);
    });
  }

  createVersion(): void {
    this.update((document) => {
      const version: ProofVersion = {
        id: uid('version'),
        name: `版本 ${document.versions.length + 1}`,
        createdAt: new Date().toISOString(),
        steps: clone(document.steps),
        goal: document.goal,
      };
      document.versions.unshift(version);
      this.compareVersionId = version.id;
    });
    this.notify('已保存当前证明快照');
  }

  /* ---------------- 分支离线合并 ---------------- */

  mergePreview: MergePreview | null = null;
  mergeTargetId = '';

  /** 导出分支包：先把当时的版本快照写入文档，再下载离线包 */
  exportBranch(): { fileName: string; content: string } | null {
    const { pkg, snapshot } = createBranchPackage(this.current, this.current.author || '匿名批改');
    // 导出留下快照属于簿记动作，不产生撤销检查点；按快照 ID 去重，重试导出不产生副本
    if (!this.current.branchSnapshots.some((item) => item.id === snapshot.id)) {
      this.current.branchSnapshots.unshift(snapshot);
    }
    this.save();
    const fileName = `${this.current.title || 'proof'}-branch-${new Date().toISOString().slice(0, 10)}.gzhi.json`;
    return { fileName, content: JSON.stringify(pkg, null, 2) };
  }

  /** 解析导入包并生成合并预览；找不到共同快照时用旧稿现有内容合成基线 */
  importBranch(raw: string): { ok: boolean; message: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, message: '导入失败：文件不是有效的 JSON' };
    }
    if (!isBranchPackage(parsed)) {
      return { ok: false, message: '导入失败：不是格致分支批改包' };
    }
    const pkg = parsed as BranchPackage;
    const target = this.documents.find((item) => item.id === pkg.documentId) ?? this.current;
    this.mergeTargetId = target.id;
    this.activeId = target.id;
    this.compareVersionId = '';
    this.selectedStepId = target.steps[0]?.id ?? '';
    this.importedPackage = pkg;
    this.mergePreview = planMerge(target, pkg);
    return {
      ok: true,
      message: this.mergePreview.fallbackBase
        ? '旧稿没有共同快照，已把现有步骤与符号作为共同内容'
        : '已按导出快照生成合并预览',
    };
  }

  resolveMergeConflict(conflictId: string, decision: 'local' | 'incoming' | 'restore' | 'delete' | 'drop'): void {
    if (!this.mergePreview) return;
    const conflict = this.mergePreview.conflicts.find((item) => item.id === conflictId);
    if (!conflict) return;
    if (conflict.kind === 'ref-added-to-deleted' && (decision === 'restore' || decision === 'drop')) {
      conflict.decided = decision;
    } else if (conflict.kind === 'step-delete-modified' && (decision === 'restore' || decision === 'delete')) {
      conflict.decided = decision;
    } else if (conflict.kind === 'symbol-delete-modified' && (decision === 'restore' || decision === 'delete')) {
      conflict.decided = decision;
    } else if ((conflict.kind === 'step-both-modified' || conflict.kind === 'symbol-both-modified' || conflict.kind === 'goal-both-modified')
      && (decision === 'local' || decision === 'incoming')) {
      conflict.decided = decision;
    } else {
      return;
    }
    const target = this.documents.find((item) => item.id === this.mergeTargetId);
    if (target && this.mergePreview && this.importedPackage) {
      this.mergePreview.merged = buildMerged(this.mergePreview, target, this.importedPackage);
    }
  }

  private importedPackage: BranchPackage | null = null;

  get mergePending(): MergeConflict[] {
    return this.mergePreview ? pendingConflicts(this.mergePreview) : [];
  }

  cancelMerge(): void {
    this.mergePreview = null;
    this.importedPackage = null;
    this.mergeTargetId = '';
  }

  /**
   * 确认合并：步骤、引用和旧快照一次性原子写入。
   * 全部成功后才落地 localStorage，中途失败保持原样；快照按 ID 去重，重试不多出副本。
   */
  confirmMerge(): { ok: boolean; message: string } {
    const preview = this.mergePreview;
    const target = this.documents.find((item) => item.id === this.mergeTargetId);
    const pkg = this.importedPackage;
    if (!preview || !target || !pkg) return { ok: false, message: '没有待确认的合并' };
    const pending = pendingConflicts(preview);
    if (pending.length) return { ok: false, message: `还有 ${pending.length} 项待处理冲突` };

    const { merged } = preview;
    // 写入前最后校验：正式证明不允许断链依据
    const ids = new Set(merged.steps.map((step) => step.id));
    if (merged.steps.some((step) => step.references.some((ref) => !ids.has(ref)))) {
      return { ok: false, message: '合并结果存在失效引用，已阻止写入' };
    }

    const backup = clone(this.documents);
    try {
      const next = clone(this.documents);
      const doc = next.find((item) => item.id === target.id);
      if (!doc) throw new Error('target document missing');
      doc.steps = clone(merged.steps);
      doc.symbols = clone(merged.symbols);
      doc.goal = merged.goal;
      doc.updatedAt = new Date().toISOString();
      // 导出时留下的基线快照一并写入；按 ID 去重，重复确认/重试不产生副本
      if (!doc.branchSnapshots.some((item) => item.id === pkg.snapshot.id)) {
        doc.branchSnapshots.unshift(clone(pkg.snapshot));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // 持久化成功后再切换内存状态（单一提交点）；合并前状态作为一个撤销检查点
      this.undoStack.push(backup);
      if (this.undoStack.length > 80) this.undoStack.shift();
      this.redoStack = [];
      this.documents = next;
      this.activeId = doc.id;
      this.selectedStepId = doc.steps[0]?.id ?? '';
      this.mergePreview = null;
      this.importedPackage = null;
      this.mergeTargetId = '';
      return { ok: true, message: '合并完成：步骤、引用与快照已一并写入' };
    } catch (error) {
      this.documents = backup;
      return { ok: false, message: `合并写入失败，文档未改动：${error instanceof Error ? error.message : '未知错误'}` };
    }
  }

  notify(message: string): void {
    this.toast = message;
    window.setTimeout(() => {
      if (this.toast === message) {
        this.toast = '';
        redraw();
      }
    }, 2200);
  }
}

function stripLatexCommands(text: string): string {
  return text.replace(/\\[A-Za-z]+/g, ' ').replace(/[{}_^]/g, ' ');
}

export function validate(document: ProofDocument): ProofCheck[] {
  const checks: ProofCheck[] = [];
  const ids = new Set(document.steps.map((step) => step.id));
  const symbolKeys = new Set(Object.keys(document.symbols));
  const ignored = new Set(['a', 'A', 'b', 'B', 'n', 'k', 'P', 'Q', 'R', 'x', 'y', 'to', 'text', 'frac', 'sqrt']);

  document.steps.forEach((step, index) => {
    const tokens = stripLatexCommands(step.statement).match(/\b[A-Za-z][A-Za-z0-9']*\b/g) ?? [];
    const unknown = [...new Set(tokens.filter((token) => !symbolKeys.has(token) && !ignored.has(token)))];
    if (unknown.length) {
      checks.push({ id: `symbol-${step.id}`, severity: 'warning', title: '发现未定义符号', detail: `步骤 ${index + 1} 使用了：${unknown.join('、')}`, stepId: step.id });
    }

    step.references.forEach((reference) => {
      if (!ids.has(reference)) {
        checks.push({ id: `missing-${step.id}-${reference}`, severity: 'error', title: '引用步骤不存在', detail: `步骤 ${index + 1} 引用了已删除的步骤 ${reference}`, stepId: step.id });
      }
    });
  });

  const graph = new Map(document.steps.map((step) => [step.id, step.references.filter((id) => ids.has(id))]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleStep = new Set<string>();
  const visit = (id: string, path: string[]): boolean => {
    if (visiting.has(id)) {
      path.slice(path.indexOf(id)).forEach((item) => cycleStep.add(item));
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    const hasCycle = (graph.get(id) ?? []).some((next) => visit(next, [...path, id]));
    visiting.delete(id);
    visited.add(id);
    return hasCycle;
  };
  [...graph.keys()].forEach((id) => visit(id, []));
  if (cycleStep.size) {
    checks.push({ id: 'cycle', severity: 'error', title: '检测到循环引用', detail: '引用链形成闭环，请调整步骤关系。', stepId: [...cycleStep][0] });
  }

  const goalStep = document.steps.find((step) => step.type === 'goal' && step.rule === '结论');
  if (!goalStep) {
    checks.push({ id: 'goal-missing', severity: 'error', title: '目标未被证明', detail: '请添加“结论”类型的最终步骤。' });
  } else if (goalStep.references.length === 0) {
    checks.push({ id: 'goal-unlinked', severity: 'warning', title: '结论尚无推导支撑', detail: '最终步骤没有引用任何前置步骤。', stepId: goalStep.id });
  }

  if (!checks.some((check) => check.severity === 'error')) {
    checks.push({ id: 'proof-ok', severity: 'info', title: '结构检查通过', detail: '未发现缺失引用、循环引用或未证明目标。' });
  }
  return checks;
}

export function compareVersion(document: ProofDocument, version: ProofVersion) {
  const result = [];
  const size = Math.max(document.steps.length, version.steps.length);
  for (let index = 0; index < size; index += 1) {
    const before = version.steps[index]?.statement ?? '';
    const after = document.steps[index]?.statement ?? '';
    const kind = !before ? 'added' : !after ? 'removed' : before === after ? 'same' : 'changed';
    result.push({ kind, label: `步骤 ${index + 1}`, before, after } as const);
  }
  return result;
}

export function createId(prefix: string): string {
  return uid(prefix);
}
