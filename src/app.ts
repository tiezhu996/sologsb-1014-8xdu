import m, { type Component } from 'mithril';
import katex from 'katex';
import { compareVersion, ProofStore, RULES } from './store';
import type { MergeResolution, ProofDocument, ProofStep } from './types';

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

const stepStatusMeta: Record<string, { label: string; tone: string }> = {
  unchanged: { label: '一致', tone: 'same' },
  'local-only': { label: '本地新增', tone: 'local' },
  'incoming-only': { label: '导入新增', tone: 'incoming' },
  'changed-local': { label: '本地修改 · 自动接收', tone: 'local' },
  'changed-incoming': { label: '导入修改 · 自动接收', tone: 'incoming' },
  'changed-both': { label: '两侧都改 · 待裁决', tone: 'conflict' },
  'deleted-local': { label: '本地删除', tone: 'deleted' },
  'deleted-incoming': { label: '导入删除', tone: 'deleted' },
  'changed-local-deleted-incoming': { label: '本地改 / 导入删 · 待裁决', tone: 'conflict' },
  'deleted-local-changed-incoming': { label: '本地删 / 导入改 · 待裁决', tone: 'conflict' },
};

function download(name: string, content: string, mime: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: mime }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_') || 'proof';

function handleImportFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importBundle(JSON.parse(String(reader.result)), file.name);
    } catch {
      store.notify('导入失败：文件不是有效的交换包');
    }
    m.redraw();
  };
  reader.onerror = () => store.notify('读取文件失败');
  reader.readAsText(file);
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

  private renderMergeDialog(): m.Children {
    const session = store.mergeSession;
    if (!session) return null;
    const pending = store.mergePending;
    const incoming = session.incoming;
    const docMismatch = incoming.docId !== store.current.id;

    const countBy = (statuses: string[]) =>
      session.stepRows.filter((row) => statuses.includes(row.status)).length;
    const autoAccepted = countBy(['changed-local', 'changed-incoming', 'local-only', 'incoming-only', 'deleted-local', 'deleted-incoming']);
    const conflicts = countBy(['changed-both', 'changed-local-deleted-incoming', 'deleted-local-changed-incoming']);

    const pick = (id: string, options: [MergeResolution, string][]) =>
      m('div.resolution', options.map(([value, label]) =>
        m('button.button.is-small', {
          class: store.mergeResolutions.get(id) === value ? 'is-link is-selected' : '',
          onclick: () => { store.setMergeResolution(id, value); m.redraw(); },
        }, label)));

    const renderStepValue = (step: ProofStep | undefined): m.Children =>
      step ? [m('strong', step.statement), m('small', `规则：${step.rule}${step.note ? ` · 旁注：${step.note}` : ''}`)] : m('em.deleted-copy', '（已删除）');

    return m('div.diff-overlay', { onclick: () => { store.cancelMerge(); m.redraw(); } }, [
      m('section.diff-dialog.merge-dialog', { onclick: (event: Event) => event.stopPropagation() }, [
        m('header.diff-head', [
          m('div', [
            m('span.eyebrow', 'BRANCH MERGE'),
            m('h2', `合并分支包 · ${store.mergeFileName}`),
            m('p.merge-sub', [
              session.legacy
                ? m('span.tag.is-warning.merge-flag', '旧稿无快照：共同内容已作为基线')
                : m('span.tag.is-info.merge-flag', `基线快照 ${session.baselineId?.slice(-6) ?? ''}`),
              docMismatch && m('span.tag.is-warning.merge-flag', '文档来源不同，仍按稳定编号合并'),
            ]),
          ]),
          m('button.delete', { onclick: () => { store.cancelMerge(); m.redraw(); } }),
        ]),
        m('div.diff-summary.merge-summary', [
          m('span.tag.is-success', `自动接收 ${autoAccepted}`),
          m('span.tag.is-danger', `待裁决 ${pending.length}`),
          m('span.tag.is-light', `一致 ${countBy(['unchanged'])}`),
          m('span.tag.is-warning', `同改冲突 ${conflicts}`),
        ]),
        m('div.merge-body', [
          m('div.merge-section', [
            m('h3', '步骤合并'),
            m('div.merge-table.merge-step-table', [
              m('div.merge-row.merge-header', [m('span', '编号'), m('span', '状态'), m('span', '本地'), m('span', '导入分支'), m('span', '裁决')]),
              ...session.stepOrder.map((key) => {
                const row = session.stepRows.find((item) => item.key === key)!;
                const meta = stepStatusMeta[row.status];
                const resolutionId = row.status === 'changed-both'
                  ? `step:${key}`
                  : (row.status === 'changed-local-deleted-incoming' || row.status === 'deleted-local-changed-incoming')
                    ? `moddelete-step:${key}`
                    : '';
                const resolved = resolutionId ? store.mergeResolutions.get(resolutionId) : undefined;
                return m('div.merge-row', { class: `tone-${meta.tone}${resolved ? ' is-resolved' : ''}` }, [
                  m('span.merge-key', key),
                  m('span.merge-status', m('span.tag', { class: `is-${meta.tone === 'same' ? 'light' : meta.tone === 'deleted' ? 'danger' : meta.tone === 'conflict' ? 'warning' : meta.tone === 'local' ? 'info' : 'success'}` }, meta.label)),
                  m('span.merge-cell', renderStepValue(row.local)),
                  m('span.merge-cell', renderStepValue(row.incoming)),
                  m('span.merge-cell', resolutionId
                    ? row.status === 'changed-both'
                      ? pick(resolutionId, [['keep-local', '采用本地'], ['keep-incoming', '采用导入']])
                      : pick(resolutionId, [['keep', '保留改动'], ['delete', '接受删除']])
                    : m('span.auto-copy', '—')),
                ]);
              }),
            ]),
          ]),
          this.renderSymbolMerge(pick),
          this.renderGoalMerge(pick),
          ...pending
            .filter((item) => item.kind === 'dangling' || item.kind === 'cycle')
            .map((item) => m('div.merge-section', [
              m('h3', item.kind === 'dangling' ? `断链依据 · 引用 ${item.referrerKeys?.join('、')} → ${item.targetKey}` : '循环引用'),
              m('p.merge-detail', item.localSummary),
              m('p.merge-detail', item.incomingSummary),
              m('div.resolution', item.kind === 'dangling'
                ? pick(item.id, [['keep', '恢复被删步骤，保留依据'], ['delete', '删去这条引用']])
                : pick(item.id, [['break-local', '断开本地新增引用'], ['break-incoming', '断开导入新增引用']])),
            ])),
          m('div.merge-legend', '说明：只改一处的编辑已自动接收；两侧同改或“删除 × 新增依据”必须先裁决。确认后步骤、引用与历史快照一次写入，未裁决前不会改动当前稿。'),
        ]),
        m('footer.merge-foot', [
          m('div', pending.length
            ? m('span.tag.is-danger', `仍有 ${pending.length} 项待处理`)
            : m('span.tag.is-success', '全部可自动合并')),
          m('div.merge-foot-actions', [
            m('button.button', { onclick: () => { store.cancelMerge(); m.redraw(); } }, '取消'),
            m('button.button.is-primary', {
              disabled: pending.length > 0,
              onclick: () => { store.confirmMerge(); m.redraw(); },
            }, '确认合并并写入'),
          ]),
        ]),
      ]),
    ]);
  }

  private renderSymbolMerge(pick: (id: string, options: [MergeResolution, string][]) => m.Children): m.Children {
    const session = store.mergeSession!;
    const rows = session.symbolOrder
      .map((key) => ({ key, status: session.symbolStatus.get(key)! }))
      .filter((row) => row.status !== 'unchanged' && row.status !== 'deleted-local' && row.status !== 'deleted-incoming');
    if (!rows.length) return null;
    const localSymbols = store.current.symbols;
    return m('div.merge-section', [
      m('h3', '符号表合并'),
      m('div.merge-table', [
        m('div.merge-row.merge-header', [m('span', '符号'), m('span', '状态'), m('span', '本地'), m('span', '导入分支'), m('span', '裁决')]),
        ...rows.map(({ key, status }) => {
          const local = key in localSymbols ? localSymbols[key] : undefined;
          const incoming = key in session.incoming.symbols ? session.incoming.symbols[key] : undefined;
          const resolutionId = status === 'changed-both' ? `symbol:${key}` : `moddelete-symbol:${key}`;
          const resolved = store.mergeResolutions.get(resolutionId);
          const options: [MergeResolution, string][] = status === 'changed-both'
            ? [['keep-local', '采用本地'], ['keep-incoming', '采用导入']]
            : [['keep', '保留'], ['delete', '删除']];
          return m('div.merge-row', { class: resolved ? 'is-resolved' : '' }, [
            m('span.merge-key', m('code', key)),
            m('span.merge-status', status === 'changed-both' || status.includes('deleted') ? '待裁决' : '自动接收'),
            m('span.merge-cell', local ?? m('em.deleted-copy', '（已删除）')),
            m('span.merge-cell', incoming ?? m('em.deleted-copy', '（已删除）')),
            m('span.merge-cell', status === 'changed-both' || status.includes('deleted') ? pick(resolutionId, options) : m('span.auto-copy', '—')),
          ]);
        }),
      ]),
    ]);
  }

  private renderGoalMerge(pick: (id: string, options: [MergeResolution, string][]) => m.Children): m.Children {
    const session = store.mergeSession!;
    if (session.goalStatus === 'unchanged') return null;
    const auto = session.goalStatus === 'changed-local' || session.goalStatus === 'changed-incoming';
    return m('div.merge-section', [
      m('h3', '证明目标'),
      m('div.merge-table', [
        m('div.merge-row.merge-header', [m('span', '状态'), m('span', '本地'), m('span', '导入分支'), m('span', '裁决')]),
        m('div.merge-row', [
          m('span.merge-status', auto ? '自动接收' : '两侧都改 · 待裁决'),
          m('span.merge-cell', store.current.goal),
          m('span.merge-cell', session.incoming.goal),
          m('span.merge-cell', auto ? m('span.auto-copy', '—') : pick('goal', [['keep-local', '采用本地'], ['keep-incoming', '采用导入']])),
        ]),
      ]),
    ]);
  }

  onremove(): void {
    window.removeEventListener('keydown', this.onKeyDown);
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
              m('button.button.is-small.is-primary', {
                onclick: () => {
                  const bundle = store.exportBundle();
                  download(`${safeFileName(document.title)}-branch.json`, JSON.stringify(bundle, null, 2), 'application/json;charset=utf-8');
                  m.redraw();
                },
                title: '固化基线快照并导出离线合并包',
              }, '⇪ 导出分支包'),
              m('button.button.is-small.is-primary.is-outlined', {
                onclick: () => (globalThis.document.getElementById('merge-file-input') as HTMLInputElement | null)?.click(),
                title: '导入其他电脑的分支包',
              }, '⇩ 导入并合并'),
              m('input#merge-file-input[type=file][accept=.json,application/json]', {
                style: { display: 'none' },
                onchange: (event: Event) => {
                  const input = event.target as HTMLInputElement;
                  const file = input.files?.[0];
                  if (file) handleImportFile(file);
                  input.value = '';
                },
              }),
              m('span.export-divider'),
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
                  m('span.step-id', `${step.key} · #${shortId(step.id)}`),
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
      selectedVersion && m('div.diff-overlay', { onclick: () => { store.compareVersionId = ''; m.redraw(); } }, [
        m('section.diff-dialog', { onclick: (event: Event) => event.stopPropagation() }, [
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
      this.renderMergeDialog(),
      store.toast && m('div.toast-notification', store.toast),
    ]);
  }
}
