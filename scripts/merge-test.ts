/* 合并引擎端到端测试：node --experimental-strip-types 不便，故用 esbuild 打包后运行 */
import assert from 'node:assert';
import { buildBundle, createMergeSession, normalizeBundle } from '../src/merge';
import type { ProofBundle, ProofDocument, ProofStep, MergeResolution, ProofVersion } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function step(id: string, key: string, patch: Partial<ProofStep> = {}): ProofStep {
  return {
    id,
    key,
    type: 'derivation',
    statement: `stmt-${key}`,
    rule: '等式变形',
    references: [],
    note: '',
    counterexample: '',
    alternative: '',
    ...patch,
  };
}

function versionOf(doc: ProofDocument, id: string, name = '基线'): ProofVersion {
  return { id, name, createdAt: '2026-09-01T00:00:00.000Z', steps: structuredClone(doc.steps), goal: doc.goal, symbols: structuredClone(doc.symbols) };
}

function makeDoc(steps: ProofStep[], symbols: Record<string, string> = { x: 'X' }, goal = 'G0', stepSeq?: number): ProofDocument {
  const seq = stepSeq ?? Math.max(0, ...steps.map((s) => Number(s.key.slice(1)) || 0));
  return {
    id: 'doc-1',
    title: '测试稿',
    author: '本地',
    goal,
    symbols,
    steps,
    versions: [],
    stepSeq: seq,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

/** 在某份文档的基础上导出交换包 */
function exportFrom(doc: ProofDocument, baselineId = 'v-base'): ProofBundle {
  const versions = doc.versions.some((v) => v.id === baselineId)
    ? doc.versions
    : [versionOf(doc, baselineId), ...doc.versions];
  const withVersions: ProofDocument = { ...doc, versions };
  const baseline = versions.find((v) => v.id === baselineId)!;
  return buildBundle(withVersions, baseline, '2026-10-02T00:00:00.000Z');
}

function autoResolve(session: ReturnType<typeof createMergeSession>, extra: Record<string, MergeResolution> = {}): Map<string, MergeResolution> {
  const resolutions = new Map<string, MergeResolution>(Object.entries(extra));
  // 若仍有待处理，报错并打印
  const pending = session.listPending(resolutions);
  if (pending.length) {
    throw new Error(`意外的待处理项：\n${pending.map((p) => `${p.id} (${p.kind})`).join('\n')}`);
  }
  return resolutions;
}

const createId = (prefix: string) => `${prefix}-new-${Math.random().toString(36).slice(2, 8)}`;

// 场景 1：单侧改动自动接收
{
  const base = makeDoc([step('a', 'S1'), step('b', 'S2')]);
  const remote = makeDoc([step('a', 'S1'), step('b', 'S2', { statement: 'stmt-S2-remote' })]);
  const local = makeDoc([step('a', 'S1', { statement: 'stmt-S1-local' }), step('b', 'S2')]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  const merged = session.buildMerged(local, autoResolve(session), createId, 'now');
  test('单侧修改自动接收：两侧改动合并且无待处理', () => {
    assert.equal(merged.steps.length, 2);
    assert.equal(merged.steps.find((s) => s.key === 'S1')!.statement, 'stmt-S1-local');
    assert.equal(merged.steps.find((s) => s.key === 'S2')!.statement, 'stmt-S2-remote');
  });
}

// 场景 2：同一处两侧都改 → 待处理，未裁决不能确认
{
  const base = makeDoc([step('a', 'S1', { statement: 'v0' })]);
  const local = makeDoc([step('a', 'S1', { statement: 'local' })]);
  const remote = makeDoc([step('a', 'S1', { statement: 'remote' })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('两侧同改一步：列为待处理，未裁决时确认失败且不产出结果', () => {
    assert.equal(session.listPending(new Map()).length, 1);
    assert.equal(session.listPending(new Map())[0].kind, 'step');
    assert.throws(() => session.buildMerged(local, new Map(), createId, 'now'), /待处理/);
  });
  test('裁决保留本地 / 导入侧后可确认', () => {
    const r1 = autoResolve(session, { 'step:S1': 'keep-local' });
    assert.equal(session.buildMerged(local, r1, createId, 'now').steps[0].statement, 'local');
    const r2 = autoResolve(session, { 'step:S1': 'keep-incoming' });
    assert.equal(session.buildMerged(local, r2, createId, 'now').steps[0].statement, 'remote');
  });
}

// 场景 3：一侧删除步骤，另一侧新增引用 → dangling 待处理
{
  const baseSteps = [step('a', 'S1'), step('b', 'S2')];
  const base = makeDoc(baseSteps);
  // 本地：新增 S3，引用 S2
  const localSteps = [step('a', 'S1'), step('b', 'S2'), step('c', 'S3', { references: ['b'] })];
  const local = makeDoc(localSteps, { x: 'X' }, 'G0', 3);
  // 远端：删除 S2
  const remoteSteps = [step('a', 'S1')];
  const remote = makeDoc(remoteSteps);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('删步骤 × 新增引用撞车：列为 dangling 待处理', () => {
    const pending = session.listPending(new Map());
    assert.equal(pending.length, 1);
    assert.equal(pending[0].kind, 'dangling');
    assert.equal(pending[0].targetKey, 'S2');
  });
  test('选择删引用：正式证明中没有断掉的依据', () => {
    const r = autoResolve(session, { 'dangling:S3:S2': 'delete' });
    const merged = session.buildMerged(local, r, createId, 'now');
    assert.deepEqual(merged.steps.find((s) => s.key === 'S3')!.references, []);
    assert.equal(merged.steps.find((s) => s.key === 'S2'), undefined);
  });
  test('选择保留依据：S2 与 S3 的引用都恢复', () => {
    const r = autoResolve(session, { 'dangling:S3:S2': 'keep' });
    const merged = session.buildMerged(local, r, createId, 'now');
    assert.ok(merged.steps.find((s) => s.key === 'S2'));
    const s3 = merged.steps.find((s) => s.key === 'S3')!;
    assert.equal(s3.references.length, 1);
    assert.equal(merged.steps.find((s) => s.id === s3.references[0])!.key, 'S2');
  });
}

// 场景 4：一侧删除、另一侧修改同一步 → moddelete 待处理
{
  const base = makeDoc([step('a', 'S1', { statement: 'v0' })]);
  const local = makeDoc([step('a', 'S1', { statement: 'v0' })]);
  const remote = makeDoc([step('a', 'S1', { statement: 'remote-edit' })]);
  // 本地删除：从 base 复制快照，但 steps 为空
  const localDeleted = makeDoc([]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(localDeleted, bundle);
  test('本地删 × 导入侧改：moddelete 待处理，默认不让改动丢失', () => {
    const pending = session.listPending(new Map());
    assert.equal(pending[0].kind, 'step-moddelete');
    assert.equal(pending[0].stepKey, 'S1');
  });
  test('确认删除后步骤消失；确认保留后改动进入', () => {
    const rDel = autoResolve(session, { 'moddelete-step:S1': 'delete' });
    assert.equal(session.buildMerged(localDeleted, rDel, createId, 'now').steps.length, 0);
    const rKeep = autoResolve(session, { 'moddelete-step:S1': 'keep' });
    const merged = session.buildMerged(localDeleted, rKeep, createId, 'now');
    assert.equal(merged.steps[0].statement, 'remote-edit');
  });
  void local;
}

// 场景 5：符号表按基线合并
{
  const base = makeDoc([step('a', 'S1')], { common: '共同', onlyLocal: 'L0', onlyRemote: 'R0', changed: 'base' });
  const local = makeDoc(
    [step('a', 'S1'), step('l', 'S2', { statement: 's2' })],
    { common: '共同', onlyLocal: 'L0', changed: 'local-edit', newLocal: 'NL' },
    'G0',
    2,
  );
  const remote = makeDoc(
    [step('a', 'S1')],
    { common: '共同', onlyLocal: 'L0', onlyRemote: 'R0', changed: 'remote-edit', newRemote: 'NR' },
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('符号单侧增改自动接收，双侧同改列待处理', () => {
    const pending = session.listPending(new Map());
    assert.equal(pending.filter((p) => p.kind === 'symbol' && p.symbol === 'changed').length, 1);
    // 本地删除基线中的 onlyRemote（远端未改）→ 自动接收删除
    assert.equal(session.symbolStatus.get('onlyRemote'), 'deleted-local');
  });
  test('裁决后符号表包含：共同 + 单侧新增 + 选中的改动；自动删除项移除', () => {
    const r = autoResolve(session, { 'symbol:changed': 'keep-incoming' });
    const symbols = session.chosenSymbols(r);
    assert.deepEqual(symbols, {
      common: '共同',
      onlyLocal: 'L0',
      changed: 'remote-edit',
      newLocal: 'NL',
      newRemote: 'NR',
    });
  });
}

// 场景 6：旧稿无快照 —— 相同步骤当共同内容，只并入新增
{
  const common = [step('a', 'S1', { statement: 'same-1' }), step('b', 'S2', { statement: 'same-2' })];
  const local = makeDoc([...common, step('c', 'S3', { statement: 'local-new' })], {}, 'G0', 3);
  const remoteSteps = [...common, step('d', 'S4', { statement: 'remote-new' })];
  const remote = makeDoc(remoteSteps, {}, 'G0', 4);
  const bundle = normalizeBundle({
    format: 'sologsb-proof-bundle',
    version: 1,
    exportedAt: 'now',
    docId: 'doc-1',
    title: '旧稿',
    baselineId: null,
    steps: remoteSteps,
    goal: 'G0',
    symbols: {},
    stepSeq: 4,
    versions: [],
  });
  void remote;
  const session = createMergeSession(local, bundle);
  test('无快照导入：标记为 legacy，相同内容不产生冲突', () => {
    assert.equal(session.legacy, true);
    assert.equal(session.stepStatus.get('S1'), 'unchanged');
    assert.equal(session.stepStatus.get('S3'), 'local-only');
    assert.equal(session.stepStatus.get('S4'), 'incoming-only');
  });
  test('双方各自新增的步骤都进入合并稿', () => {
    const merged = session.buildMerged(local, autoResolve(session), createId, 'now');
    const keys = merged.steps.map((s) => s.key).sort();
    assert.deepEqual(keys, ['S1', 'S2', 'S3', 'S4']);
  });
}

// 场景 7：旧稿无快照但同一步骤两侧内容不同 → 冲突
{
  const local = makeDoc([step('a', 'S1', { statement: 'L' })]);
  const remote = makeDoc([step('a', 'S1', { statement: 'R' })]);
  const bundle = normalizeBundle({
    format: 'sologsb-proof-bundle', version: 1, exportedAt: 'now', docId: 'doc-1', title: '旧稿',
    baselineId: null, steps: remote.steps, goal: 'G0', symbols: {}, stepSeq: 1, versions: [],
  });
  const session = createMergeSession(local, bundle);
  test('无快照且同编号步骤内容不同：双侧冲突，需裁决', () => {
    assert.equal(session.stepStatus.get('S1'), 'changed-both');
    assert.equal(session.listPending(new Map()).length, 1);
  });
}

// 场景 8：旧快照一并写入 + 按 id 去重，重试不多副本
{
  const base = makeDoc([step('a', 'S1')]);
  const local: ProofDocument = { ...makeDoc([step('a', 'S1')]), versions: [versionOf(base, 'v-shared', '共同旧快照')] };
  const remote: ProofDocument = {
    ...makeDoc([step('a', 'S1', { statement: 'remote' })]),
    versions: [versionOf(base, 'v-base'), versionOf(base, 'v-shared', '共同旧快照'), { ...versionOf(base, 'v-r2', '远端快照'), createdAt: '2026-09-02T00:00:00.000Z' }],
  };
  const bundle = exportFrom(remote);
  const session = createMergeSession(local, bundle);
  const r = autoResolve(session);
  test('确认后基线与远端旧快照写入，已有的共同快照不重复', () => {
    const merged = session.buildMerged(local, r, createId, 'now');
    const ids = merged.versions.map((v) => v.id);
    assert.deepEqual([...new Set(ids)].sort(), ids.sort());
    assert.ok(ids.includes('v-base'));
    assert.ok(ids.includes('v-r2'));
    assert.equal(ids.filter((id) => id === 'v-shared').length, 1);
  });
  test('同一份裁决重复确认（重试）结果幂等', () => {
    const merged1 = session.buildMerged(local, r, createId, 'now');
    const merged2 = session.buildMerged(local, r, createId, 'now');
    assert.equal(merged1.versions.length, merged2.versions.length);
    assert.deepEqual(merged1.steps.map((s) => [s.key, s.statement]), merged2.steps.map((s) => [s.key, s.statement]));
  });
}

// 场景 9：跨设备 id 撞车时重新分配，引用不串
{
  const base = makeDoc([step('same', 'S1')]);
  const local = makeDoc(
    [step('same', 'S1'), step('dup', 'S2', { statement: 'local-S2', references: ['same'] })],
    {}, 'G0', 2,
  );
  const remote = makeDoc(
    [step('same', 'S1'), step('dup', 'S2', { statement: 'remote-S2' }), step('other', 'S3', { references: ['dup'] })],
    {}, 'G0', 3,
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('两侧新增同 id 步骤：id 重新分配且各自引用正确（S2 双侧冲突需裁决）', () => {
    assert.equal(session.stepStatus.get('S2'), 'changed-both');
    const r = autoResolve(session, { 'step:S2': 'keep-local' });
    const merged = session.buildMerged(local, r, createId, 'now');
    const ids = merged.steps.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    const s3 = merged.steps.find((s) => s.key === 'S3')!;
    const s2 = merged.steps.find((s) => s.key === 'S2')!;
    assert.equal(merged.steps.find((s) => s.id === s3.references[0])!.key, s2.key);
    assert.equal(s2.statement, 'local-S2');
  });
}

// 场景 10：目标单侧改自动接收；双侧改待处理
{
  const base = makeDoc([step('a', 'S1')], {}, 'G-base');
  const local = makeDoc([step('a', 'S1')], {}, 'G-base');
  const remote = makeDoc([step('a', 'S1')], {}, 'G-remote');
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('目标单侧修改自动接收', () => {
    const r = autoResolve(session);
    assert.equal(session.buildMerged(local, r, createId, 'now').goal, 'G-remote');
  });
  const local2 = makeDoc([step('a', 'S1')], {}, 'G-local');
  const session2 = createMergeSession(local2, bundle);
  test('目标双侧修改列为待处理', () => {
    assert.equal(session2.listPending(new Map())[0].kind, 'goal');
  });
}

// 场景 11：仅引用变化的单侧编辑自动接收，引用按稳定编号重建
{
  const base = makeDoc([step('a', 'S1'), step('b', 'S2'), step('c', 'S3')]);
  const local = makeDoc([step('a', 'S1'), step('b', 'S2'), step('c', 'S3', { statement: 'local-edit' })], {}, 'G0', 3);
  const remote = makeDoc(
    [step('a', 'S1'), step('b', 'S2', { references: ['a'] }), step('c', 'S3')],
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('引用在远端单侧新增时自动并入，合并后引用指向重新分配的正确 id', () => {
    const merged = session.buildMerged(local, autoResolve(session), createId, 'now');
    const byKey = new Map(merged.steps.map((s) => [s.key, s]));
    assert.deepEqual(byKey.get('S2')!.references, [byKey.get('S1')!.id]);
    assert.deepEqual(byKey.get('S3')!.references, []);
    assert.equal(byKey.get('S3')!.statement, 'local-edit');
  });
}

// 场景 12：导入完全无变化的包 —— 全部 unchanged
{
  const base = makeDoc([step('a', 'S1')], { x: 'X' }, 'G');
  const bundle = exportFrom({ ...base, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(base, bundle);
  test('无变化时零待处理、零改动', () => {
    const merged = session.buildMerged(base, autoResolve(session), createId, 'now');
    assert.equal(merged.steps.length, 1);
    assert.equal(merged.goal, 'G');
    assert.deepEqual(merged.symbols, { x: 'X' });
  });
}

// 场景 13：两侧各加一条引用，合并后形成闭环 → cycle 待处理，裁决断开一侧
{
  const base = makeDoc([step('a', 'S1'), step('b', 'S2')]);
  // 本地：S1 引用 S2
  const local = makeDoc([step('a', 'S1', { references: ['b'] }), step('b', 'S2')]);
  // 远端：S2 引用 S1
  const remote = makeDoc([step('a', 'S1'), step('b', 'S2', { references: ['a'] })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('新增引用两侧成环：列为 cycle 待处理，不裁决不能确认', () => {
    const pending = session.listPending(new Map());
    assert.equal(pending[pending.length - 1].kind, 'cycle');
    assert.throws(() => session.buildMerged(local, new Map(), createId, 'now'), /待处理/);
  });
  test('断开本地新增边后环消失，远端边保留', () => {
    const r = autoResolve(session, { cycle: 'break-local' });
    const merged = session.buildMerged(local, r, createId, 'now');
    const byKey = new Map(merged.steps.map((s) => [s.key, s]));
    assert.deepEqual(byKey.get('S1')!.references, []);
    assert.deepEqual(byKey.get('S2')!.references, [byKey.get('S1')!.id]);
  });
}

// 场景 14：基线里就存在的旧引用所指步骤被一侧删除 —— 自动清理，不算撞车待处理
{
  const base = makeDoc([step('a', 'S1', { references: ['b'] }), step('b', 'S2')]);
  const local = makeDoc([step('a', 'S1', { references: ['b'] }), step('b', 'S2')]);
  // 远端干净删除 S2（编辑器删除步骤时会自动摘掉对它的引用）
  const remote = makeDoc([step('a', 'S1', { references: [] })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, 'v-base')] });
  const session = createMergeSession(local, bundle);
  test('旧引用随被删步骤自动清理：无 dangling 待处理，结果无断链', () => {
    const pending = session.listPending(new Map());
    assert.equal(pending.length, 0);
    const merged = session.buildMerged(local, autoResolve(session), createId, 'now');
    assert.equal(merged.steps.length, 1);
    assert.deepEqual(merged.steps[0].references, []);
  });
}

// 场景 15：导出包自身可再被原样导入（基线快照与内容一致 → 零改动）
{
  const doc = makeDoc([step('a', 'S1')], { x: 'X' }, 'G');
  const withBaseline: ProofDocument = { ...doc, versions: [versionOf(doc, 'v-base')] };
  const bundle = buildBundle(withBaseline, withBaseline.versions[0], 'now');
  const session = createMergeSession(doc, bundle);
  test('导出包按基线导入原文档：全部 unchanged 且基线快照在合并稿中', () => {
    const merged = session.buildMerged(doc, autoResolve(session), createId, 'now');
    assert.equal(session.stepRows.every((r) => r.status === 'unchanged'), true);
    assert.ok(merged.versions.some((v) => v.id === 'v-base'));
  });
}

console.log(`\n全部 ${passed} 组测试通过`);
