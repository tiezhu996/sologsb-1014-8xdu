/* ProofStore 端到端：localStorage 桩环境，验证真实导出/导入/确认流程 */
import assert from 'node:assert';
import { ProofStore } from '../src/store';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  removeItem(key: string): void { this.map.delete(key); }
  clear(): void { this.map.clear(); }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { setTimeout };
// notify() 的延迟回调会触发 Mithril redraw，Node 下无挂载根，测试结束后忽略这类异步异常
process.on('uncaughtException', (error) => {
  if (error instanceof TypeError && /schedule/.test(error.message)) return;
  throw error;
});

let passed = 0;
const test = (name: string, fn: () => void): void => { fn(); passed += 1; console.log(`  ✓ ${name}`); };

// 旧数据（无 key / stepSeq / version.symbols）迁移
localStorage.setItem('sologsb-1014-proof-workspace-v1', JSON.stringify([{
  id: 'old-doc', title: '旧稿', author: 'a', goal: 'G',
  symbols: { x: 'X' },
  steps: [
    { id: 'q1', type: 'premise', statement: 's1', rule: '前提', references: [], note: '', counterexample: '', alternative: '' },
    { id: 'q2', type: 'derivation', statement: 's2', rule: '等式变形', references: ['q1'], note: '', counterexample: '', alternative: '' },
  ],
  versions: [{ id: 'v-old', name: 'n', createdAt: '2026-01-01T00:00:00.000Z', steps: [], goal: 'G' }],
  updatedAt: '2026-01-01T00:00:00.000Z',
}]));

const storeA = new ProofStore();
test('旧稿加载时补发稳定编号、stepSeq 与快照 symbols', () => {
  const doc = storeA.documents[0];
  assert.equal(doc.steps[0].key, 'S1');
  assert.equal(doc.steps[1].key, 'S2');
  assert.equal(doc.stepSeq, 2);
  assert.deepEqual(doc.versions[0].symbols, {});
});

// A 机导出分支包
const bundle = storeA.exportBundle();
test('导出包包含基线 id 与基线快照', () => {
  assert.equal(typeof bundle.baselineId, 'string');
  assert.ok(bundle.versions.some((v) => v.id === bundle.baselineId));
  assert.equal(bundle.steps.length, 2);
});

// B 机：初始内容与 A 导出前一致
localStorage.clear();
const baseDoc = structuredClone(storeA.documents[0]);
baseDoc.versions = [];
const storeB = new ProofStore();
storeB.documents = [baseDoc];
storeB.activeId = baseDoc.id;

// B 本地修改 S1 的命题（单侧改动，应自动接收）
storeB.selectStep(baseDoc.steps[0].id);
storeB.updateStep({ statement: 'B 机修改后的命题' });

// A 机在导出后也改了 S2（构造 incoming 与 baseline 不同）：直接修改 bundle 模拟 A 侧后续编辑
const incomingEdited = structuredClone(bundle);
incomingEdited.steps.find((s) => s.key === 'S2')!.statement = 'A 机继续修改的命题';

test('导入后生成合并预览，单侧改动无待处理', () => {
  assert.equal(storeB.importBundle(incomingEdited, 'branch.json'), true);
  assert.equal(storeB.mergePending.length, 0);
});

// 确认前的失败重试演练：人为制造一个未裁决冲突，确认必须失败且不写
storeB.cancelMerge();
const conflictBundle = structuredClone(incomingEdited);
conflictBundle.steps.find((s) => s.key === 'S1')!.statement = 'A 对 S1 的另一种改法';
storeB.importBundle(conflictBundle, 'conflict.json');
const versionsBefore = storeB.current.versions.length;
const stepsSnapshotBefore = structuredClone(storeB.current.steps);
test('两侧同改时确认失败，文档与快照数量不变', () => {
  assert.equal(storeB.mergePending.length, 1);
  assert.equal(storeB.confirmMerge(), false);
  assert.equal(storeB.current.versions.length, versionsBefore);
  assert.deepEqual(storeB.current.steps, stepsSnapshotBefore);
  assert.ok(storeB.mergeSession); // 会话保留以便裁决后重试
});

test('裁决后重试确认成功；再点确认不会重复写入快照', () => {
  storeB.setMergeResolution('step:S1', 'keep-local');
  assert.equal(storeB.mergePending.length, 0);
  assert.equal(storeB.confirmMerge(), true);
  const versionsAfterFirst = storeB.current.versions.length;
  const mergedSteps = storeB.current.steps;
  assert.ok(mergedSteps.some((s) => s.statement === 'B 机修改后的命题'));
  assert.ok(mergedSteps.some((s) => s.statement === 'A 机继续修改的命题'));
  assert.ok(storeB.current.versions.some((v) => v.id === bundle.baselineId));
  // 会话已结束，重试确认是空操作
  assert.equal(storeB.confirmMerge(), false);
  assert.equal(storeB.current.versions.length, versionsAfterFirst);
});

test('合并结果无缺失引用、无循环引用（旧稿原有的内容性错误不计）', () => {
  const blocking = storeB.checks.filter(
    (c) => c.severity === 'error' && (c.title === '引用步骤不存在' || c.title === '检测到循环引用'),
  );
  assert.deepEqual(blocking, []);
  const s2 = storeB.current.steps.find((s) => s.key === 'S2')!;
  const s1 = storeB.current.steps.find((s) => s.key === 'S1')!;
  assert.deepEqual(s2.references, [s1.id]);
});

// 旧稿无快照导入：共同内容视为基线，新增步骤并入
localStorage.clear();
const storeC = new ProofStore();
const legacyLocal = structuredClone(baseDoc);
storeC.documents = [legacyLocal];
storeC.activeId = legacyLocal.id;
const legacyBundle = {
  format: 'sologsb-proof-bundle', version: 1, exportedAt: 'now', docId: legacyLocal.id,
  title: legacyLocal.title, baselineId: null,
  steps: structuredClone(legacyLocal.steps),
  goal: legacyLocal.goal, symbols: {}, stepSeq: 2, versions: [],
};
test('无快照旧包可导入，标记 legacy 且零冲突', () => {
  assert.equal(storeC.importBundle(legacyBundle, 'legacy.json'), true);
  assert.equal(storeC.mergeSession!.legacy, true);
  assert.equal(storeC.mergePending.length, 0);
  assert.equal(storeC.confirmMerge(), true);
  assert.equal(storeC.current.steps.length, 2);
});

// 刷新页面后数据仍可加载（持久化往返）
const reloaded = new ProofStore();
test('合并稿持久化后重新加载，编号与引用完好', () => {
  const doc = reloaded.current;
  assert.equal(doc.steps.length, 2);
  assert.deepEqual(doc.steps.map((s) => s.key), ['S1', 'S2']);
});

console.log(`\nStore 流程 ${passed} 组测试通过`);
