import m, { type Component } from 'mithril';
import katex from 'katex';
import { compareVersion, ProofStore, RULES } from './store';
import type {
  GoalBothModifiedConflict,
  MergeConflict,
  MergePreview,
  RefAddedToDeletedConflict,
  StepBothModifiedConflict,
  StepDeleteModifiedConflict,
  SymbolBothModifiedConflict,
  SymbolDeleteModifiedConflict,
} from './merge';
import type { ProofDocument, ProofStep } from './types';

const store = new ProofStore();

const snippets = [
  { label: '∀', value: '\\forall ' },
  { label: '∃', value: '\\exists ' },
  { label: '→', value: '\\to ' },
  { label: '⇔', value: '\\iff ' },
  { label: '≠', value: '\\ne ' },
  { label: '≤', value: '\\le ' },
  { label: '≥', value: '\\ge ' },
  { label: '∈', value: '\\in ' },
  { label: '∑', value: '\\sum_{i=1}^{n} ' },
  { label: '√', value: '\\sqrt{}' },
  { label: '分式', value: '\\frac{}{}' },
  { label: '上标', value: '^{}' },
  { label: '下标', value: '_{}' },
];

const typeLabel: Record<ProofStep['type'], string> = {
  premise: '前提',
  derivation: '推导',
  goal: '目标 / 结论',
};

function renderRichText(text: string): m.Children {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      try {
        return m.trust(katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' }));
      } catch {
        return part;
      }
    }
    return part;
  });
}

function shortId(id: string): string {
  return id.replace(/^step-/, '').slice(-4).toUpperCase();
}

function download(name: string, content: string, mime: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: mime }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportMarkdown(document: ProofDocument): string {
  const lines = [`# ${document.title}`, '', `**证明目标：** $${document.goal}$`, ''];
  document.steps.forEach((step, index) => {
    const refs = step.references.map((id) => `步骤 ${document.steps.findIndex((item) => item.id === id) + 1}`).filter((ref) => ref !== '步骤 0');
    lines.push(`## ${index + 1}. ${step.statement}`);
    lines.push('');
    lines.push(`- 类型：${typeLabel[step.type]}`);
    lines.push(`- 推理规则：${step.rule}`);
    if (refs.length) lines.push(`- 依据：${refs.join('、')}`);
    if (step.note) lines.push(`- 旁注：${step.note}`);
    if (step.counterexample) lines.push(`- 反例：${step.counterexample}`);
    if (step.alternative) lines.push(`- 替代分支：${step.alternative}`);
    lines.push('');
  });
  lines.push('## 符号表');
  Object.entries(document.symbols).forEach(([symbol, meaning]) => lines.push(`- $${symbol}$：${meaning}`));
  return lines.join('\n');
}

function exportLatex(document: ProofDocument): string {
  const lines = ['\\documentclass{article}', '\\usepackage{amsmath,amssymb}', '\\begin{document}', `\\section*{${document.title}}`, `\\textbf{证明目标：} $${document.goal}$`, '\\begin{enumerate}'];
  document.steps.forEach((step) => {
    const refs = step.references.map((id) => document.steps.findIndex((item) => item.id === id) + 1).filter(Boolean);
    const support = refs.length ? `（依据 ${refs.join(', ')}；${step.rule}）` : `（${step.rule}）`;
    lines.push(`  \\item ${step.statement} ${support}`);
    if (step.note) lines.push(`  \\par\\small 旁注：${step.note}`);
  });
  lines.push('\\end{enumerate}', '\\end{document}');
  return lines.join('\n');
}

export class ProofApp implements Component {
  private readonly onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const inEditor = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? store.redo() : store.undo();
      m.redraw();
      return;
    }
    if (command && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      store.redo();
      m.redraw();
      return;
    }
    if (command && event.key === 'Enter') {
      event.preventDefault();
      store.addStep(event.shiftKey ? 'goal' : 'derivation');
      m.redraw();
      return;
    }
    if (command && event.key.toLowerCase() === 's') {
      event.preventDefault();
      store.save();
      store.notify('已保存到浏览器');
      m.redraw();
      return;
    }
    if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && !inEditor) {
      event.preventDefault();
      const steps = store.current.steps;
      const index = steps.findIndex((step) => step.id === store.selectedStepId);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, steps.length - 1) : Math.max(index - 1, 0);
      store.selectStep(steps[next]?.id ?? '');
      document.querySelector(`[data-step="${store.selectedStepId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      m.redraw();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !inEditor && store.selectedStepId) {
      event.preventDefault();
      store.removeStep(store.selectedStepId);
      m.redraw();
    }
  };

  oncreate(): void {
    window.addEventListener('keydown', this.onKeyDown);
  }

  onremove(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private exportBranch(): void {
    const result = store.exportBranch();
    if (!result) return;
    download(result.fileName, result.content, 'application/json;charset=utf-8');
    store.notify('已留下基线快照，分支包已下载');
  }

  private importBranchClick(): void {
    const input = document.querySelector<HTMLInputElement>('#branch-import-input');
    if (!input) return;
    input.value = '';
    input.click();
  }

  private importBranchFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = store.importBranch(String(reader.result ?? ''));
      store.notify(result.message);
      m.redraw();
    };
    reader.onerror = () => store.notify('读取文件失败');
    reader.readAsText(file);
  }

  private resolve(conflictId: string, decision: 'local' | 'incoming' | 'restore' | 'delete' | 'drop'): void {
    store.resolveMergeConflict(conflictId, decision);
    m.redraw();
  }

  private confirmMerge(): void {
    const result = store.confirmMerge();
    store.notify(result.message);
    m.redraw();
  }

  private conflictCard(conflict: MergeConflict): m.Children {
    const resolveButtons = (options: Array<{ value: 'local' | 'incoming' | 'restore' | 'delete' | 'drop'; label: string; cls: string }>) =>
      m('div.conflict-actions', options.map((option) => m('button.button.is-small', {
        class: `${option.cls} ${conflict.decided === option.value ? 'is-active-choice' : ''}`,
        onclick: () => this.resolve(conflict.id, option.value),
      }, option.label)));

    if (conflict.kind === 'step-both-modified') {
      const c = conflict as StepBothModifiedConflict;
      return m('article.conflict-card', [
        m('div.conflict-title', [m('span.tag.is-warning', '双方修改'), m('strong', `步骤内容冲突 · ${c.label}`)]),
        m('p.conflict-desc', `双方都修改了：${c.fields.map((field) => ({ type: '类型', statement: '命题', rule: '推理规则', note: '旁注', counterexample: '反例', alternative: '替代分支' })[field]).join('、')}`),
        m('div.conflict-sides', [
          m('div.conflict-side', [m('small', '本地稿'), renderRichText(c.local.statement)]),
          m('div.conflict-side', [m('small', '导入包'), renderRichText(c.incoming.statement)]),
        ]),
        resolveButtons([
          { value: 'local', label: '保留本地', cls: 'is-info is-light' },
          { value: 'incoming', label: '采用导入', cls: 'is-success is-light' },
        ]),
      ]);
    }

    if (conflict.kind === 'step-delete-modified') {
      const c = conflict as StepDeleteModifiedConflict;
      const deletedSide = c.deletedBy === 'local' ? '本地稿' : '导入包';
      const editedSide = c.deletedBy === 'local' ? '导入包' : '本地稿';
      return m('article.conflict-card', [
        m('div.conflict-title', [m('span.tag.is-danger', '删除 / 修改'), m('strong', `步骤去留冲突 · ${c.label}`)]),
        m('p.conflict-desc', `${deletedSide}删除了该步骤，但${editedSide}在删除后又修改了它。`),
        m('div.conflict-sides', [m('div.conflict-side', [m('small', `${editedSide}保留的内容`), renderRichText(c.kept.statement)])]),
        resolveButtons([
          { value: 'restore', label: '恢复步骤', cls: 'is-success is-light' },
          { value: 'delete', label: '确认删除', cls: 'is-danger is-light' },
        ]),
      ]);
    }

    if (conflict.kind === 'ref-added-to-deleted') {
      const c = conflict as RefAddedToDeletedConflict;
      const deletedSide = c.deletedBy === 'local' ? '本地稿' : '导入包';
      const addedSide = c.addedBy === 'local' ? '本地稿' : '导入包';
      return m('article.conflict-card', [
        m('div.conflict-title', [m('span.tag.is-danger', '依据断裂风险'), m('strong', '撤去步骤撞上新增引用')]),
        m('p.conflict-desc', [
          `${deletedSide}撤去了 `,
          m('strong', c.targetLabel),
          `，但${addedSide}让 `,
          m('strong', c.ownerLabel),
          ' 新增引用了它。不处理会让正式证明出现断掉的依据。',
        ]),
        resolveButtons([
          { value: 'restore', label: '恢复被删步骤并接上依据', cls: 'is-success is-light' },
          { value: 'drop', label: '保留删除，摘除这条引用', cls: 'is-danger is-light' },
        ]),
      ]);
    }

    if (conflict.kind === 'symbol-both-modified') {
      const c = conflict as SymbolBothModifiedConflict;
      return m('article.conflict-card', [
        m('div.conflict-title', [m('span.tag.is-warning', '符号双方修改'), m('strong', `符号 $${c.key}$ 的含义不一致`)]),
        m('div.conflict-sides', [
          m('div.conflict-side', [m('small', '本地稿'), c.local]),
          m('div.conflict-side', [m('small', '导入包'), c.incoming]),
        ]),
        resolveButtons([
          { value: 'local', label: '保留本地', cls: 'is-info is-light' },
          { value: 'incoming', label: '采用导入', cls: 'is-success is-light' },
        ]),
      ]);
    }

    if (conflict.kind === 'symbol-delete-modified') {
      const c = conflict as SymbolDeleteModifiedConflict;
      return m('article.conflict-card', [
        m('div.conflict-title', [m('span.tag.is-danger', '符号删除 / 修改'), m('strong', `符号 $${c.key}$`)]),
        m('p.conflict-desc', `${c.deletedBy === 'local' ? '本地稿' : '导入包'}删除了该符号，另一侧把含义改为“${c.modifiedValue}”。`),
        resolveButtons([
          { value: 'restore', label: '恢复符号', cls: 'is-success is-light' },
          { value: 'delete', label: '确认删除', cls: 'is-danger is-light' },
        ]),
      ]);
    }

    const c = conflict as GoalBothModifiedConflict;
    return m('article.conflict-card', [
      m('div.conflict-title', [m('span.tag.is-warning', '目标双方修改'), m('strong', '证明目标不一致')]),
      m('div.conflict-sides', [
        m('div.conflict-side', [m('small', '本地稿'), renderRichText(`$${c.local}$`)]),
        m('div.conflict-side', [m('small', '导入包'), renderRichText(`$${c.incoming}$`)]),
      ]),
      resolveButtons([
        { value: 'local', label: '保留本地', cls: 'is-info is-light' },
        { value: 'incoming', label: '采用导入', cls: 'is-success is-light' },
      ]),
    ]);
  }

  private mergeOverlay(preview: MergePreview): m.Children {
    const pending = store.mergePending;
    const changeLabel: Record<string, string> = {
      'step-added': '步骤新增',
      'step-removed': '步骤撤去',
      'step-field-changed': '步骤修改',
      'ref-added': '新增引用',
      'ref-removed': '摘除引用',
      'symbol-added': '符号新增',
      'symbol-removed': '符号撤去',
      'symbol-changed': '符号修改',
      'goal-changed': '目标修改',
    };
    return m('div.diff-overlay', { onclick: () => { store.cancelMerge(); m.redraw(); } }, [
      m('section.merge-dialog', { onclick: (event: Event) => event.stopPropagation() }, [
        m('header.diff-head', [
          m('div', [
            m('span.eyebrow', 'BRANCH MERGE'),
            m('h2', '离线分支合并'),
            m('small.merge-sub', preview.fallbackBase
              ? '旧稿中没有这份快照：已把已有步骤与符号当作共同内容，仅接收另一侧的新增与改动。'
              : `共同基线：${preview.snapshot.name}（${new Date(preview.snapshot.createdAt).toLocaleString('zh-CN')}）`),
          ]),
          m('button.delete', { onclick: () => { store.cancelMerge(); m.redraw(); } }, '×'),
        ]),
        m('div.diff-summary', [
          m('span.tag.is-success', `自动接收 ${preview.changes.length} 项`),
          m('span.tag.is-warning', `待处理 ${pending.length} 项`),
          m('span.tag.is-light', `合并后 ${preview.merged.steps.length} 步`),
        ]),
        m('div.merge-body', [
          preview.conflicts.length > 0 && m('section.merge-section', [
            m('h3.merge-section-title', `待处理冲突（${pending.length} 项未定）`),
            m('div.merge-conflicts', preview.conflicts.map((conflict) => this.conflictCard(conflict))),
          ]),
          m('section.merge-section', [
            m('h3.merge-section-title', '只改一处，自动接收'),
            preview.changes.length === 0
              ? m('p.empty-copy', '没有单方改动。')
              : m('div.change-list', preview.changes.map((change) => m('div.change-item', [
                  m('span.tag', { class: change.side === 'local' ? 'is-info is-light' : 'is-success is-light' }, change.side === 'local' ? '本地' : '导入'),
                  m('strong', changeLabel[change.kind] ?? change.kind),
                  m('span.change-detail', `${change.label}${change.detail ? ` · ${change.detail}` : ''}`),
                ]))),
          ]),
        ]),
        m('footer.merge-foot', [
          m('p.merge-hint', pending.length > 0
            ? `还有 ${pending.length} 项冲突需要选择，正式证明不会写入断掉的依据。`
            : '冲突已全部处理，合并将原子写入步骤、引用与基线快照。'),
          m('div', [
            m('button.button', { onclick: () => { store.cancelMerge(); m.redraw(); } }, '取消'),
            m('button.button.is-primary', {
              disabled: pending.length > 0,
              onclick: () => this.confirmMerge(),
            }, '确认合并写入'),
          ]),
        ]),
      ]),
    ]);
  }

  view(): m.Children {
    const document = store.current;
    const selected = store.selectedStep;
    const checks = store.checks;
    const errors = checks.filter((check) => check.severity === 'error').length;
    const warnings = checks.filter((check) => check.severity === 'warning').length;
    const selectedVersion = document.versions.find((version) => version.id === store.compareVersionId);
    const diff = selectedVersion ? compareVersion(document, selectedVersion) : [];

    return m('div.app-shell', [
      m('header.topbar', [
        m('div.brand', [
          m('div.brand-mark', '∑'),
          m('div', [m('p.eyebrow', 'FORMAL NOTEBOOK'), m('h1', '格致 · 证明编辑器')]),
        ]),
        m('div.topbar-center', [
          m('span.status-dot', { class: errors ? 'has-error' : 'is-ok' }),
          errors ? `${errors} 个结构错误` : '证明结构可检查',
          m('span.topbar-separator'),
          `自动保存于 ${new Date(document.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
        ]),
        m('div.actions', [
          m('button.button.is-light', { onclick: () => { store.undo(); m.redraw(); }, disabled: !store.undoStack.length, title: '撤销 Ctrl+Z' }, '↶ 撤销'),
          m('button.button.is-light', { onclick: () => { store.redo(); m.redraw(); }, disabled: !store.redoStack.length, title: '重做 Ctrl+Y' }, '↷ 重做'),
          m('button.button.is-link', { onclick: () => { store.addStep('derivation'); m.redraw(); }, title: '添加步骤 Ctrl+Enter' }, '+ 添加步骤'),
        ]),
      ]),
      m('main.workspace', [
        m('aside.left-rail', [
          m('section.panel.document-panel', [
            m('div.panel-heading', [m('span', '证明文档'), m('button.icon-button', { onclick: () => { store.addDocument(); m.redraw(); }, title: '新建证明' }, '+')]),
            m('div.document-list', store.documents.map((item) => m('button.document-item', {
              class: item.id === document.id ? 'is-active' : '',
              onclick: () => { store.selectDocument(item.id); m.redraw(); },
            }, [
              m('span.document-glyph', item.steps.length),
              m('span.document-copy', [m('strong', item.title), m('small', `${item.steps.length} 步 · ${item.author}`)]),
              m('span.chevron', '›'),
            ]))),
          ]),
          m('section.panel.version-panel', [
            m('div.panel-heading', [m('span', '版本快照'), m('span.count-badge', document.versions.length)]),
            document.versions.length === 0 && m('p.empty-copy', '保存快照后，可以并排查看改动。'),
            m('div.version-list', document.versions.map((version) => m('button.version-item', {
              class: version.id === store.compareVersionId ? 'is-active' : '',
              onclick: () => { store.compareVersionId = store.compareVersionId === version.id ? '' : version.id; m.redraw(); },
            }, [
              m('span', version.name),
              m('small', new Date(version.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })),
            ]))),
            m('button.button.is-fullwidth.is-small', { onclick: () => { store.createVersion(); m.redraw(); } }, '＋ 保存当前版本'),
          ]),
          m('section.panel.version-panel', [
            m('div.panel-heading', [m('span', '合并基线快照'), m('span.count-badge', document.branchSnapshots.length)]),
            document.branchSnapshots.length === 0 && m('p.empty-copy', '导出分支包时会在此留下共同基线，供离线批改后三方合并。'),
            m('div.version-list', document.branchSnapshots.map((snapshot) => m('div.version-item', { class: 'is-baseline' }, [
              m('span', [m('strong', snapshot.name), m('br'), m('small', `${snapshot.steps.length} 步 · ${snapshot.exportedFrom === document.id ? '本文档导出' : '外部带回'}`)]),
              m('small', new Date(snapshot.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })),
            ]))),
          ]),
          m('section.check-summary', [
            m('div.check-summary-head', [
              m('div', [m('span.eyebrow', 'LIVE CHECK'), m('h2', '证明检查')]),
              m('span.check-total', { class: errors ? 'has-error' : '' }, errors + warnings),
            ]),
            m('div.check-summary-bars', [
              m('span', { style: { width: `${Math.max(8, 100 - errors * 24 - warnings * 12)}%` } }),
            ]),
            m('p', errors ? '修正错误后再保存为定稿。' : warnings ? '结构有效，仍有待核对项。' : '当前结构与引用关系完整。'),
          ]),
        ]),
        m('section.editor-column', [
          m('div.editor-titlebar', [
            m('div', [
              m('input.title-input', { value: document.title, oninput: (event: Event) => { store.update((item) => { item.title = (event.target as HTMLInputElement).value; }); } }),
              m('div.editor-meta', [`${document.author} · ${document.steps.length} 个步骤`, m('span.keyboard-hint', '拖动 ⠿ 排序')]),
            ]),
            m('div.export-actions', [
              m('button.button.is-small.is-info.is-light', { onclick: () => this.exportBranch(), title: '留下当前版本快照并下载离线批改包' }, '⇪ 导出分支包'),
              m('button.button.is-small.is-success.is-light', { onclick: () => this.importBranchClick(), title: '选择他人批改的分支包进行离线合并' }, '⇩ 导入合并'),
              m('input[type=file]', {
                id: 'branch-import-input',
                accept: '.json,application/json',
                style: { display: 'none' },
                onchange: (event: Event) => this.importBranchFile(event),
              }),
              m('button.button.is-small', { onclick: () => download(`${document.title}.md`, exportMarkdown(document), 'text/markdown;charset=utf-8') }, '导出 Markdown'),
              m('button.button.is-small', { onclick: () => download(`${document.title}.tex`, exportLatex(document), 'application/x-tex;charset=utf-8') }, '导出 LaTeX'),
            ]),
          ]),
          m('section.goal-card', [
            m('div.goal-label', '证明目标'),
            m('div.goal-formula', renderRichText(`$${document.goal}$`)),
            m('input.formula-input', {
              value: document.goal,
              onfocus: (event: Event) => { store.lastInput = event.target as HTMLInputElement; },
              oninput: (event: Event) => store.update((item) => { item.goal = (event.target as HTMLInputElement).value; }),
              'aria-label': '证明目标',
            }),
          ]),
          m('div.steps-toolbar', [
            m('div', [m('strong', '证明步骤'), m('span.steps-count', `${document.steps.length} 步`)]),
            m('div.steps-toolbar-actions', [
              m('button.button.is-small.is-white', { onclick: () => { store.addStep('premise'); m.redraw(); } }, '＋ 前提'),
              m('button.button.is-small.is-white', { onclick: () => { store.addStep('derivation'); m.redraw(); } }, '＋ 推导'),
              m('button.button.is-small.is-white', { onclick: () => { store.addStep('goal'); m.redraw(); } }, '＋ 结论'),
            ]),
          ]),
          m('div.steps-list', document.steps.length === 0 && m('div.empty-state', '尚无步骤。按 Ctrl+Enter 开始添加。'), document.steps.map((step, index) => {
            const stepChecks = checks.filter((check) => check.stepId === step.id);
            return m('article.step-card', {
              'data-step': step.id,
              class: step.id === store.selectedStepId ? 'is-selected' : '',
              draggable: true,
              onclick: () => { store.selectStep(step.id); m.redraw(); },
              ondragstart: () => { store.dragStepId = step.id; },
              ondragover: (event: DragEvent) => event.preventDefault(),
              ondrop: (event: DragEvent) => { event.preventDefault(); store.moveStep(store.dragStepId, step.id); store.dragStepId = ''; m.redraw(); },
            }, [
              m('div.step-rail', [
                m('span.drag-handle', { title: '拖动排序' }, '⠿'),
                m('span.step-number', String(index + 1).padStart(2, '0')),
              ]),
              m('div.step-body', [
                m('div.step-head', [
                  m('span.tag', { class: step.type === 'goal' ? 'is-success' : step.type === 'premise' ? 'is-info' : 'is-light' }, typeLabel[step.type]),
                  m('span.rule-chip', step.rule),
                  m('span.step-id', `#${shortId(step.id)}`),
                  stepChecks.length > 0 && m('span.issue-badge', `${stepChecks.length} 项检查`),
                  m('button.step-menu', { onclick: (event: Event) => { event.stopPropagation(); store.removeStep(step.id); m.redraw(); }, title: '删除步骤' }, '×'),
                ]),
                m('div.step-statement', renderRichText(step.statement)),
                m('div.step-footer', [
                  m('span', step.references.length ? `依据：${step.references.map((reference) => {
                    const referenceIndex = document.steps.findIndex((item) => item.id === reference);
                    return referenceIndex >= 0 ? `步骤 ${referenceIndex + 1}` : `缺失 ${shortId(reference)}`;
                  }).join('、')}` : '独立前提'),
                  step.note && m('span.has-note', '含旁注'),
                  step.counterexample && m('span.has-counterexample', '含反例'),
                  step.alternative && m('span.has-branch', '含替代分支'),
                ]),
              ]),
            ]);
          })),
        ]),
        m('aside.right-rail', [
          selected ? m('section.panel.inspector', [
            m('div.panel-heading', [m('span', '步骤检查器'), m('span.inspector-step', `#${shortId(selected.id)}`)]),
            m('label.field-label', '步骤类型'),
            m('div.select.is-fullwidth', m('select', { value: selected.type, onchange: (event: Event) => store.updateStep({ type: (event.target as HTMLSelectElement).value as ProofStep['type'] }) }, Object.entries(typeLabel).map(([value, label]) => m('option', { value }, label)))),
            m('label.field-label', '推理规则'),
            m('div.select.is-fullwidth', m('select', { value: selected.rule, onchange: (event: Event) => store.updateStep({ rule: (event.target as HTMLSelectElement).value }) }, RULES.map((rule) => m('option', { value: rule }, rule)))),
            m('label.field-label', '命题或推导式'),
            m('textarea.textarea.formula-textarea', {
              value: selected.statement,
              rows: 4,
              onfocus: (event: Event) => { store.lastInput = event.target as HTMLTextAreaElement; },
              oninput: (event: Event) => store.updateStep({ statement: (event.target as HTMLTextAreaElement).value }),
            }),
            m('div.formula-toolbar', snippets.map((snippet) => m('button.formula-key', {
              title: `插入 ${snippet.label}`,
              onclick: (event: Event) => {
                event.preventDefault();
                const input = store.lastInput;
                if (!input) return;
                const start = input.selectionStart ?? input.value.length;
                const end = input.selectionEnd ?? start;
                const next = input.value.slice(0, start) + snippet.value + input.value.slice(end);
                input.value = next;
                if (input instanceof HTMLTextAreaElement) store.updateStep({ statement: next });
                else store.update((document) => { document.goal = next; });
                input.focus();
                const cursor = start + snippet.value.length;
                input.setSelectionRange(cursor, cursor);
                m.redraw();
              },
            }, snippet.label))),
            m('label.field-label', '引用步骤'),
            m('div.reference-list', document.steps.filter((step) => step.id !== selected.id).map((step) => m('label.reference-item', [
              m('input', {
                type: 'checkbox',
                checked: selected.references.includes(step.id),
                onchange: (event: Event) => {
                  const checked = (event.target as HTMLInputElement).checked;
                  const references = checked ? [...selected.references, step.id] : selected.references.filter((id) => id !== step.id);
                  store.updateStep({ references });
                },
              }),
              m('span', `步骤 ${document.steps.indexOf(step) + 1}`),
              m('small', step.statement.replace(/\$/g, '')),
            ]))),
            m('div.field-grid', [
              m('div', [m('label.field-label', '旁注'), m('textarea.textarea.is-small', { rows: 2, value: selected.note, placeholder: '记录思路或条件', oninput: (event: Event) => store.updateStep({ note: (event.target as HTMLTextAreaElement).value }) })]),
              m('div', [m('label.field-label', '反例 / 边界情况'), m('textarea.textarea.is-small', { rows: 2, value: selected.counterexample, placeholder: '尝试寻找反例', oninput: (event: Event) => store.updateStep({ counterexample: (event.target as HTMLTextAreaElement).value }) })]),
              m('div', [m('label.field-label', '替代分支'), m('textarea.textarea.is-small', { rows: 2, value: selected.alternative, placeholder: '另一种可行推导', oninput: (event: Event) => store.updateStep({ alternative: (event.target as HTMLTextAreaElement).value }) })]),
            ]),
            m('button.button.is-small.is-white.is-fullwidth.add-symbol', {
              onclick: () => {
                const symbol = window.prompt('输入符号名称');
                if (!symbol) return;
                const meaning = window.prompt('输入符号含义') ?? '待补充';
                store.update((document) => { document.symbols[symbol] = meaning; });
                m.redraw();
              },
            }, '＋ 登记新符号'),
          ]) : m('section.panel.inspector', m('p.empty-copy', '选择一个步骤进行检查。')),
          m('section.panel.symbol-panel', [
            m('div.panel-heading', [m('span', '符号表'), m('span.count-badge', Object.keys(document.symbols).length)]),
            m('div.symbol-list', Object.entries(document.symbols).map(([symbol, meaning]) => m('div.symbol-row', [
              m('code', symbol),
              m('input.symbol-meaning', { value: meaning, oninput: (event: Event) => store.update((item) => { item.symbols[symbol] = (event.target as HTMLInputElement).value; }) }),
            ]))),
          ]),
          m('section.panel.checks-panel', [
            m('div.panel-heading', [m('span', '检查结果'), m('span.count-badge', checks.length)]),
            m('div.check-list', checks.map((check) => m('button.check-item', {
              class: check.severity,
              onclick: () => { if (check.stepId) { store.selectStep(check.stepId); globalThis.document.querySelector(`[data-step="${check.stepId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } m.redraw(); },
            }, [
              m('span.check-icon', check.severity === 'error' ? '×' : check.severity === 'warning' ? '!' : '✓'),
              m('span', [m('strong', check.title), m('small', check.detail)]),
            ]))),
          ]),
          m('section.shortcut-card', [
            m('span.eyebrow', 'KEYBOARD'),
            m('p', [m('kbd', 'Ctrl'), ' + ', m('kbd', 'Enter'), ' 新步骤']),
            m('p', [m('kbd', 'Alt'), ' + ', m('kbd', '↑↓'), ' 切换步骤']),
            m('p', [m('kbd', 'Ctrl'), ' + ', m('kbd', 'Z'), ' 撤销']),
          ]),
        ]),
      ]),
      selectedVersion && m('div.diff-overlay', { onclick: () => { store.compareVersionId = ''; m.redraw(); } }, [        m('section.diff-dialog', { onclick: (event: Event) => event.stopPropagation() }, [
          m('header.diff-head', [
            m('div', [m('span.eyebrow', 'VERSION DIFF'), m('h2', `${selectedVersion.name} ↔ 当前版本`)]),
            m('button.delete', { onclick: () => { store.compareVersionId = ''; m.redraw(); } }),
          ]),
          m('div.diff-summary', [
            m('span.tag.is-danger', `删除 ${diff.filter((item) => item.kind === 'removed').length}`),
            m('span.tag.is-success', `新增 ${diff.filter((item) => item.kind === 'added').length}`),
            m('span.tag.is-warning', `修改 ${diff.filter((item) => item.kind === 'changed').length}`),
            m('span.tag.is-light', `未变 ${diff.filter((item) => item.kind === 'same').length}`),
          ]),
          m('div.diff-table', [
            m('div.diff-row.diff-header', [m('span', '位置'), m('span', '旧版本'), m('span', '当前版本')]),
            ...diff.map((item) => m('div.diff-row', { class: `is-${item.kind}` }, [
              m('span.diff-label', item.label),
              m('span', item.before || '—'),
              m('span', item.after || '—'),
            ])),
          ]),
        ]),
      ]),
      store.mergePreview && this.mergeOverlay(store.mergePreview),
      store.toast && m('div.toast-notification', store.toast),
    ]);
  }
}
