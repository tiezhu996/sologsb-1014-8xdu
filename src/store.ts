import { redraw } from 'mithril';
import { buildBundle, createMergeSession, type MergeSession } from './merge';
import type {
  MergePending,
  MergeResolution,
  ProofBundle,
  ProofCheck,
  ProofDocument,
  ProofStep,
  ProofVersion,
} from './types';

const STORAGE_KEY = 'sologsb-1014-proof-workspace-v1';
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T>(value: T): T => structuredClone(value);

/** 给旧稿补发稳定编号：按步骤现有顺序分配，编号只增不复用 */
function migrateDocument(document: ProofDocument): ProofDocument {
  let seq = document.stepSeq ?? 0;
  const used = new Set<string>();
  document.steps.forEach((step) => {
    if (!step.key || used.has(step.key)) {
      do {
        seq += 1;
        step.key = `S${seq}`;
      } while (used.has(step.key));
    }
    used.add(step.key);
  });
  document.stepSeq = Math.max(seq, ...[...used].map((key) => Number(key.slice(1)) || 0), 0);
  document.versions?.forEach((version) => {
    version.symbols ??= {};
  });
  document.versions ??= [];
  return document;
}

/** 下一枚稳定编号（只计算，不写入；由更新闭包内自增 stepSeq） */
function nextStepKey(document: ProofDocument): string {
  return `S${(document.stepSeq ?? 0) + 1}`;
}

/** 宽松校验交换包：正式包有 format 标记；旧稿导出的纯文档快照也接受（无基线） */
function parseBundle(raw: unknown): ProofBundle | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Partial<ProofBundle>;
  const hasSteps = Array.isArray(data.steps);
  if (data.format === 'sologsb-proof-bundle') {
    if (!hasSteps) return null;
    return data as ProofBundle;
  }
  // 兼容没有 format 标记、但结构像 ProofDocument 的旧稿
  if (hasSteps && (typeof data.goal === 'string' || typeof data.title === 'string')) {
    return {
      format: 'sologsb-proof-bundle',
      version: 1,
      exportedAt: new Date().toISOString(),
      docId: typeof data.docId === 'string' ? data.docId : uid('doc'),
      title: typeof data.title === 'string' ? data.title : '导入的旧稿',
      baselineId: null,
      steps: data.steps as ProofStep[],
      goal: typeof data.goal === 'string' ? data.goal : '',
      symbols: data.symbols && typeof data.symbols === 'object' ? data.symbols : {},
      stepSeq: typeof data.stepSeq === 'number' ? data.stepSeq : 0,
      versions: Array.isArray(data.versions) ? data.versions : [],
    };
  }
  return null;
}

export const RULES = ['前提', '定义展开', '代入', '等式变形', '分配律', '同类项合并', '数学归纳', '反证法', '构造法', '结论'];

function sampleSteps(): ProofStep[] {
  return [
    { id: 's1', key: 'S1', type: 'premise', statement: '$a,b$ 是实数', rule: '前提', references: [], note: '采用实数域中的交换律与分配律。', counterexample: '', alternative: '' },
    { id: 's2', key: 'S2', type: 'derivation', statement: '$(a+b)^2=(a+b)(a+b)$', rule: '定义展开', references: ['s1'], note: '把平方写成两个相同因式之积。', counterexample: '', alternative: '' },
    { id: 's3', key: 'S3', type: 'derivation', statement: '$(a+b)(a+b)=a^2+ab+ba+b^2$', rule: '分配律', references: ['s2'], note: '', counterexample: '', alternative: '也可先展开后半部分。' },
    { id: 's4', key: 'S4', type: 'derivation', statement: '$a^2+ab+ba+b^2=a^2+2ab+b^2$', rule: '同类项合并', references: ['s3'], note: '由实数的交换律，$ab=ba$。', counterexample: '', alternative: '' },
    { id: 's5', key: 'S5', type: 'goal', statement: '$(a+b)^2=a^2+2ab+b^2$', rule: '结论', references: ['s4'], note: '目标已由步骤 1 至 4 逐项推出。', counterexample: '', alternative: '' },
  ];
}

function issueSteps(): ProofStep[] {
  return [
    { id: 'i1', key: 'S1', type: 'premise', statement: '$n$ 是正整数', rule: '前提', references: [], note: '', counterexample: '', alternative: '' },
    { id: 'i2', key: 'S2', type: 'derivation', statement: '$P(1)$ 成立', rule: '前提', references: ['i1'], note: '归纳基例。', counterexample: '', alternative: '' },
    { id: 'i3', key: 'S3', type: 'derivation', statement: '若 $P(k)$ 成立，则 $P(k+1)$ 也成立', rule: '数学归纳', references: ['missing-step'], note: '这里故意保留一个失效引用，用于演示检查。', counterexample: '', alternative: '' },
    { id: 'i4', key: 'S4', type: 'goal', statement: '$P(n)$ 对所有正整数 $n$ 成立', rule: '结论', references: ['i3'], note: '尚未补齐归纳假设。', counterexample: '', alternative: '' },
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
      stepSeq: 5,
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
      stepSeq: 4,
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
    return parsed.map((document) => migrateDocument(document));
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
  mergeSession: MergeSession | null = null;
  mergeResolutions = new Map<string, MergeResolution>();
  mergeFileName = '';

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
      steps: [{ id: uid('step'), key: 'S1', type: 'premise', statement: '在这里输入前提', rule: '前提', references: [], note: '', counterexample: '', alternative: '' }],
      versions: [],
      stepSeq: 1,
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
    const key = nextStepKey(this.current);
    const step: ProofStep = {
      id: uid('step'),
      key,
      type,
      statement: type === 'goal' ? '$A=B$' : '输入新的推导式',
      rule: type === 'goal' ? '结论' : '等式变形',
      references: this.selectedStepId ? [this.selectedStepId] : [],
      note: '',
      counterexample: '',
      alternative: '',
    };
    this.update((document) => {
      document.stepSeq += 1;
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

  createVersion(): ProofVersion {
    let version!: ProofVersion;
    this.update((document) => {
      version = {
        id: uid('version'),
        name: `版本 ${document.versions.length + 1}`,
        createdAt: new Date().toISOString(),
        steps: clone(document.steps),
        goal: document.goal,
        symbols: clone(document.symbols),
      };
      document.versions.unshift(version);
      this.compareVersionId = version.id;
    });
    this.notify('已保存当前证明快照');
    return version;
  }

  /** 导出离线合并包：先留下当时的版本快照（基线），再打包 */
  exportBundle(): ProofBundle {
    const baseline: ProofVersion = {
      id: uid('version'),
      name: `导出基线 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      steps: clone(this.current.steps),
      goal: this.current.goal,
      symbols: clone(this.current.symbols),
    };
    this.update((document) => {
      // 同一基线若已存在（重试导出）不重复写入
      if (!document.versions.some((version) => version.id === baseline.id)) {
        document.versions.unshift(baseline);
      }
    });
    this.notify('已固化导出基线并生成交换包');
    return buildBundle(this.current, baseline, new Date().toISOString());
  }

  /** 读取交换包并生成合并预览；旧稿没有快照时按共同内容建立基线 */
  importBundle(raw: unknown, fileName: string): boolean {
    const bundle = parseBundle(raw);
    if (!bundle) {
      this.notify('导入失败：不是有效的证明交换包');
      return false;
    }
    this.mergeSession = createMergeSession(this.current, bundle);
    this.mergeResolutions = new Map();
    this.mergeFileName = fileName;
    this.notify(this.mergeSession.legacy ? '旧稿无快照：已把共同内容作为基线' : '已按导出基线生成合并预览');
    return true;
  }

  get mergePending(): MergePending[] {
    return this.mergeSession?.listPending(this.mergeResolutions) ?? [];
  }

  setMergeResolution(id: string, resolution: MergeResolution): void {
    this.mergeResolutions.set(id, resolution);
    if (id.startsWith('moddelete-step:')) {
      const key = id.slice('moddelete-step:'.length);
      if (resolution === 'keep') {
        // 保留被删步骤的改动侧：所有指向它的新增引用随之恢复
        this.mergePending.forEach((pending) => {
          if (pending.kind === 'dangling' && pending.targetKey === key) {
            this.mergeResolutions.set(pending.id, 'keep');
          }
        });
      } else {
        this.mergePending.forEach((pending) => {
          if (pending.kind === 'dangling' && pending.targetKey === key) {
            this.mergeResolutions.set(pending.id, 'delete');
          }
        });
      }
    }
  }

  /** 确认合并：先在内存中构造完整结果并校验，再一次写入；失败不改任何数据 */
  confirmMerge(): boolean {
    if (!this.mergeSession) return false;
    let merged: ProofDocument;
    try {
      merged = this.mergeSession.buildMerged(this.current, this.mergeResolutions, uid, new Date().toISOString());
      const introduced = mergeIntroducedErrors(this.current, this.mergeSession.incoming.steps, merged);
      if (introduced.length) throw new Error(`合并将引入断链或循环引用：${introduced.join('；')}`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '仍有待处理项，未写入任何内容');
      return false;
    }
    this.undoStack.push(clone(this.documents));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    const index = this.documents.findIndex((item) => item.id === this.current.id);
    this.documents[index] = merged;
    this.selectedStepId = merged.steps[0]?.id ?? '';
    this.save();
    this.cancelMerge();
    this.notify('合并完成：步骤、引用与历史快照已一并写入');
    return true;
  }

  cancelMerge(): void {
    this.mergeSession = null;
    this.mergeResolutions = new Map();
    this.mergeFileName = '';
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

/** 找出合并相对两侧原稿“新引入”的结构问题：断掉的依据与循环引用（按稳定编号定位） */
function mergeIntroducedErrors(
  local: ProofDocument,
  incomingSteps: ProofStep[],
  after: ProofDocument,
): string[] {
  const problems: string[] = [];
  const edgeKey = (fromKey: string, rawRef: string, steps: ProofStep[]): string => {
    const target = steps.find((step) => step.id === rawRef);
    return `${fromKey}→${target?.key ?? rawRef}`;
  };
  const danglingBefore = new Set<string>();
  const collectDangling = (steps: ProofStep[]): void => {
    const ids = new Set(steps.map((step) => step.id));
    steps.forEach((step) => {
      step.references.forEach((rawRef) => {
        if (!ids.has(rawRef)) danglingBefore.add(edgeKey(step.key, rawRef, steps));
      });
    });
  };
  collectDangling(local.steps);
  collectDangling(incomingSteps);

  const afterIds = new Set(after.steps.map((step) => step.id));
  after.steps.forEach((step, index) => {
    step.references.forEach((rawRef) => {
      if (!afterIds.has(rawRef) && !danglingBefore.has(edgeKey(step.key, rawRef, after.steps))) {
        problems.push(`步骤 ${index + 1} 出现断掉的依据`);
      }
    });
  });

  if (detectCycle(after) && !detectCycle(local) && !detectCycle({ ...local, steps: incomingSteps })) {
    problems.push('引用链形成闭环');
  }
  return problems;
}

function detectCycle(document: ProofDocument): boolean {
  const ids = new Set(document.steps.map((step) => step.id));
  const graph = new Map(document.steps.map((step) => [step.id, step.references.filter((id) => ids.has(id))]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycle = false;
  const visit = (id: string): void => {
    if (visiting.has(id)) { cycle = true; return; }
    if (visited.has(id)) return;
    visiting.add(id);
    graph.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  graph.forEach((_, id) => visit(id));
  return cycle;
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
