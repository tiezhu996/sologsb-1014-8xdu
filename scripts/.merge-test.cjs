"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/merge-test.ts
var import_node_assert = __toESM(require("node:assert"), 1);

// src/merge.ts
var STEP_FIELDS = ["type", "statement", "rule", "references", "note", "counterexample", "alternative"];
function sideRefTokens(step2, side) {
  return step2.references.map((id) => side.idToKey.get(id) ?? id);
}
function hashStep(step2, refs) {
  if (!step2) return void 0;
  const body = STEP_FIELDS.filter((field) => field !== "references").map((field) => String(step2[field])).join("");
  return `${body}${[...new Set(refs)].sort().join(",")}`;
}
function buildSide(steps) {
  const map = /* @__PURE__ */ new Map();
  const idToKey = /* @__PURE__ */ new Map();
  const order = [];
  steps.forEach((step2) => {
    if (!step2.key || map.has(step2.key)) return;
    map.set(step2.key, step2);
    idToKey.set(step2.id, step2.key);
    order.push(step2.key);
  });
  return { steps: map, order, idToKey };
}
function normalizeBundle(raw) {
  const bundle = structuredClone(raw);
  bundle.format = "sologsb-proof-bundle";
  bundle.version = 1;
  bundle.steps ??= [];
  bundle.symbols ??= {};
  bundle.versions ??= [];
  bundle.goal ??= "";
  bundle.baselineId ??= null;
  let seq = Math.max(0, bundle.stepSeq ?? 0);
  const used = /* @__PURE__ */ new Set();
  bundle.steps.forEach((step2) => {
    if (!step2.key) {
      do {
        seq += 1;
        step2.key = `S${seq}`;
      } while (used.has(step2.key));
    }
    used.add(step2.key);
    ["note", "counterexample", "alternative"].forEach((field) => {
      if (typeof step2[field] !== "string") {
        step2[field] = "";
      }
    });
    step2.references ??= [];
  });
  bundle.stepSeq = Math.max(seq, ...[...used].map((key) => Number(key.slice(1)) || 0), 0);
  bundle.versions.forEach((version) => {
    version.symbols ??= {};
  });
  return bundle;
}
var MergeSession = class {
  legacy;
  baselineId;
  localSide;
  incomingSide;
  baseSide;
  baseGoal;
  baseSymbols;
  baseVersions;
  stepRows = [];
  stepStatus = /* @__PURE__ */ new Map();
  symbolStatus = /* @__PURE__ */ new Map();
  goalStatus;
  stepOrder = [];
  symbolOrder = [];
  incoming;
  localGoal;
  localSymbols;
  constructor(local, incoming) {
    this.incoming = incoming;
    this.localGoal = local.goal;
    this.localSymbols = { ...local.symbols };
    this.localSide = buildSide(local.steps);
    this.incomingSide = buildSide(incoming.steps);
    const baseline = incoming.baselineId ? incoming.versions.find((version) => version.id === incoming.baselineId) : void 0;
    this.legacy = !baseline;
    this.baselineId = baseline?.id ?? null;
    this.baseVersions = incoming.versions;
    if (baseline) {
      this.baseSide = buildSide(baseline.steps);
      this.baseGoal = baseline.goal;
      this.baseSymbols = { ...baseline.symbols };
    } else {
      const commonSteps = local.steps.filter((localStep) => {
        const other = incoming.steps.find((candidate) => candidate.key === localStep.key);
        return other && hashStep(localStep, sideRefTokens(localStep, this.localSide)) === hashStep(other, sideRefTokens(other, this.incomingSide));
      });
      this.baseSide = buildSide(commonSteps);
      this.baseGoal = local.goal === incoming.goal ? local.goal : null;
      this.baseSymbols = Object.fromEntries(
        Object.entries(local.symbols).filter(([key, value]) => incoming.symbols[key] === value)
      );
    }
    this.buildStepRows();
    this.goalStatus = this.computeGoalStatus(local.goal, incoming.goal);
    this.buildSymbolRows(local.symbols, incoming.symbols);
    this.stepOrder = this.computeOrder(this.localSide.order, this.incomingSide.order);
    this.symbolOrder = this.computeOrder(Object.keys(local.symbols), Object.keys(incoming.symbols));
  }
  buildStepRows() {
    const keys = /* @__PURE__ */ new Set([
      ...this.baseSide.steps.keys(),
      ...this.localSide.steps.keys(),
      ...this.incomingSide.steps.keys()
    ]);
    keys.forEach((key) => {
      const local = this.localSide.steps.get(key);
      const incoming = this.incomingSide.steps.get(key);
      const inBase = this.baseSide.steps.has(key);
      let status;
      if (local && incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        if (hl === hi) status = "unchanged";
        else if (!inBase || hb === void 0) status = "changed-both";
        else if (hl === hb) status = "changed-incoming";
        else if (hi === hb) status = "changed-local";
        else status = "changed-both";
      } else if (local) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hl = hashStep(local, sideRefTokens(local, this.localSide));
        status = inBase && hb !== void 0 && hl !== hb ? "changed-local-deleted-incoming" : "deleted-incoming";
        if (!inBase) status = "local-only";
      } else if (incoming) {
        const baseStepHere = this.baseSide.steps.get(key);
        const hb = hashStep(baseStepHere, baseStepHere ? sideRefTokens(baseStepHere, this.baseSide) : []);
        const hi = hashStep(incoming, sideRefTokens(incoming, this.incomingSide));
        status = inBase && hb !== void 0 && hi !== hb ? "deleted-local-changed-incoming" : "deleted-local";
        if (!inBase) status = "incoming-only";
      } else {
        return;
      }
      this.stepStatus.set(key, status);
      this.stepRows.push({ key, status, local, incoming });
    });
  }
  computeGoalStatus(localGoal, incomingGoal) {
    if (localGoal === incomingGoal) return "unchanged";
    if (this.baseGoal === null) return "changed-both";
    if (localGoal === this.baseGoal) return "changed-incoming";
    if (incomingGoal === this.baseGoal) return "changed-local";
    return "changed-both";
  }
  buildSymbolRows(localSymbols, incomingSymbols) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(this.baseSymbols), ...Object.keys(localSymbols), ...Object.keys(incomingSymbols)]);
    keys.forEach((key) => {
      const local = localSymbols[key];
      const incoming = incomingSymbols[key];
      const base = this.baseSymbols[key];
      const localExists = key in localSymbols;
      const incomingExists = key in incomingSymbols;
      let status;
      if (localExists && incomingExists) {
        if (local === incoming) status = "unchanged";
        else if (!(key in this.baseSymbols)) status = "changed-both";
        else if (local === base) status = "changed-incoming";
        else if (incoming === base) status = "changed-local";
        else status = "changed-both";
      } else if (localExists) {
        status = key in this.baseSymbols && local !== base ? "changed-local-deleted-incoming" : "deleted-incoming";
        if (!(key in this.baseSymbols)) status = "local-only";
      } else if (incomingExists) {
        status = key in this.baseSymbols && incoming !== base ? "deleted-local-changed-incoming" : "deleted-local";
        if (!(key in this.baseSymbols)) status = "incoming-only";
      } else {
        return;
      }
      this.symbolStatus.set(key, status);
    });
  }
  /** 以本地顺序为基线，把另一侧独有步骤按相邻锚点插入；纯删除不留空 */
  computeOrder(localOrder, incomingOrder) {
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
  survivingKeys(resolutions) {
    const forced = /* @__PURE__ */ new Set();
    resolutions.forEach((value, id) => {
      if (id.startsWith("dangling:") && value === "keep") forced.add(id.split(":")[2]);
    });
    const result = /* @__PURE__ */ new Set();
    this.stepStatus.forEach((status, key) => {
      switch (status) {
        case "unchanged":
        case "changed-local":
        case "changed-incoming":
        case "changed-both":
        case "local-only":
        case "incoming-only":
          result.add(key);
          break;
        case "deleted-local":
        case "deleted-incoming":
          if (forced.has(key)) result.add(key);
          break;
        case "changed-local-deleted-incoming":
        case "deleted-local-changed-incoming":
          if (resolutions.get(`moddelete-step:${key}`) === "keep" || forced.has(key)) result.add(key);
          break;
      }
    });
    return result;
  }
  /** 当前裁决下每个保留步骤实际采用的版本（local / incoming） */
  chosenSteps(resolutions) {
    const alive = this.survivingKeys(resolutions);
    return this.stepOrder.filter((key) => alive.has(key)).map((key) => {
      const status = this.stepStatus.get(key);
      const local = this.localSide.steps.get(key);
      const incoming = this.incomingSide.steps.get(key);
      let origin;
      switch (status) {
        case "changed-incoming":
        case "incoming-only":
        case "deleted-local-changed-incoming":
          origin = "incoming";
          break;
        case "changed-local":
        case "local-only":
        case "changed-local-deleted-incoming":
          origin = "local";
          break;
        case "changed-both":
          origin = resolutions.get(`step:${key}`) === "keep-incoming" ? "incoming" : "local";
          break;
        default:
          origin = local ? "local" : "incoming";
      }
      const step2 = (origin === "local" ? local : incoming) ?? local ?? incoming;
      return { key, origin, step: step2 };
    });
  }
  chosenGoal(resolutions) {
    switch (this.goalStatus) {
      case "changed-incoming":
        return this.incoming.goal;
      case "changed-local":
        return this.localGoal;
      case "changed-both":
        return resolutions.get("goal") === "keep-incoming" ? this.incoming.goal : this.localGoal;
      default:
        return this.localGoal || this.incoming.goal;
    }
  }
  chosenSymbols(resolutions) {
    const result = {};
    const localSymbols = this.localSymbols;
    this.symbolOrder.forEach((key) => {
      const status = this.symbolStatus.get(key);
      const localExists = key in localSymbols;
      const incomingExists = key in this.incoming.symbols;
      const decision = resolutions.get(`moddelete-symbol:${key}`) ?? resolutions.get(`symbol:${key}`);
      switch (status) {
        case "unchanged":
        case "changed-local":
        case "local-only":
          if (localExists) result[key] = localSymbols[key];
          break;
        case "changed-incoming":
        case "incoming-only":
          if (incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case "changed-both":
          if (decision === "keep-incoming" && incomingExists) result[key] = this.incoming.symbols[key];
          else if (localExists) result[key] = localSymbols[key];
          break;
        case "changed-local-deleted-incoming":
          if (decision !== "delete" && localExists) result[key] = localSymbols[key];
          break;
        case "deleted-local-changed-incoming":
          if (decision === "keep" && incomingExists) result[key] = this.incoming.symbols[key];
          break;
        case "deleted-local":
        case "deleted-incoming":
          break;
      }
    });
    return result;
  }
  /** 引用边：from → 引用目标编号；含相对基线的新旧与来源侧标记 */
  effectiveEdges(resolutions) {
    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));
    const edges = [];
    chosen.forEach(({ key, origin, step: step2 }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const tokens = sideRefTokens(step2, side);
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : /* @__PURE__ */ new Set();
      tokens.forEach((to) => {
        if (!alive.has(to)) {
          if (this.isKnownKey(to)) return;
        }
        const localStep = this.localSide.steps.get(key);
        const incomingStep = this.incomingSide.steps.get(key);
        edges.push({
          from: key,
          to,
          isNew: !baseTokens.has(to),
          inLocal: !!localStep && sideRefTokens(localStep, this.localSide).includes(to),
          inIncoming: !!incomingStep && sideRefTokens(incomingStep, this.incomingSide).includes(to)
        });
      });
    });
    return edges;
  }
  isKnownKey(token) {
    return this.localSide.steps.has(token) || this.incomingSide.steps.has(token) || this.baseSide.steps.has(token);
  }
  /** 当前裁决下仍需人工处理的条目 */
  listPending(resolutions) {
    const pending = [];
    this.stepRows.forEach(({ key, status, local, incoming }) => {
      if (status === "changed-both" && !resolutions.get(`step:${key}`)) {
        pending.push({
          id: `step:${key}`,
          kind: "step",
          stepKey: key,
          localSummary: local?.statement ?? "",
          incomingSummary: incoming?.statement ?? ""
        });
      }
      if ((status === "changed-local-deleted-incoming" || status === "deleted-local-changed-incoming") && !resolutions.get(`moddelete-step:${key}`) && !this.danglingKeepFor(key, resolutions)) {
        const changed = status === "changed-local-deleted-incoming" ? local : incoming;
        pending.push({
          id: `moddelete-step:${key}`,
          kind: "step-moddelete",
          stepKey: key,
          localSummary: status === "changed-local-deleted-incoming" ? changed.statement : "\uFF08\u672C\u5730\u5DF2\u5220\u9664\u8BE5\u6B65\u9AA4\uFF09",
          incomingSummary: status === "deleted-local-changed-incoming" ? changed.statement : "\uFF08\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664\u8BE5\u6B65\u9AA4\uFF09"
        });
      }
    });
    if (this.goalStatus === "changed-both" && !resolutions.get("goal")) {
      pending.push({ id: "goal", kind: "goal", localSummary: this.localGoal, incomingSummary: this.incoming.goal });
    }
    this.symbolStatus.forEach((status, key) => {
      if (status === "changed-both" && !resolutions.get(`symbol:${key}`)) {
        pending.push({
          id: `symbol:${key}`,
          kind: "symbol",
          symbol: key,
          localSummary: this.localSymbols[key] ?? "",
          incomingSummary: this.incoming.symbols[key] ?? ""
        });
      }
      if ((status === "changed-local-deleted-incoming" || status === "deleted-local-changed-incoming") && !resolutions.get(`moddelete-symbol:${key}`)) {
        pending.push({
          id: `moddelete-symbol:${key}`,
          kind: "symbol-moddelete",
          symbol: key,
          localSummary: status === "changed-local-deleted-incoming" ? this.localSymbols[key] : "\uFF08\u672C\u5730\u5DF2\u5220\u9664\uFF09",
          incomingSummary: status === "deleted-local-changed-incoming" ? this.incoming.symbols[key] : "\uFF08\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664\uFF09"
        });
      }
    });
    const alive = this.survivingKeys(resolutions);
    this.chosenSteps(resolutions).forEach(({ key, origin, step: step2 }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const baseStep = this.baseSide.steps.get(key);
      const baseTokens = baseStep ? new Set(sideRefTokens(baseStep, this.baseSide)) : /* @__PURE__ */ new Set();
      sideRefTokens(step2, side).forEach((to) => {
        if (alive.has(to) || !this.isKnownKey(to) || baseTokens.has(to)) return;
        const id = `dangling:${key}:${to}`;
        if (resolutions.has(id)) return;
        const targetStatus = this.stepStatus.get(to);
        pending.push({
          id,
          kind: "dangling",
          stepKey: to,
          referrerKeys: [key],
          targetKey: to,
          localSummary: `\u6B65\u9AA4 ${key} \u4ECD\u9700\u5F15\u7528 ${to}\uFF08${targetStatus === "deleted-local" ? "\u672C\u5730\u5DF2\u5220\u9664" : "\u5BFC\u5165\u4FA7\u5DF2\u5220\u9664"}\uFF09`,
          incomingSummary: "\u4FDD\u7559\u8BE5\u6B65\u9AA4\u5E76\u6062\u590D\u4F9D\u636E\uFF0C\u6216\u4ECE\u6B64\u6B65\u5220\u53BB\u8FD9\u6761\u5F15\u7528"
        });
      });
    });
    const cycleEdges = this.cyclicNewEdges(resolutions);
    if (cycleEdges.size && !resolutions.get("cycle")) {
      const nodes = /* @__PURE__ */ new Set();
      cycleEdges.forEach((edge) => {
        const [from, to] = edge.split("\u2192");
        nodes.add(from);
        nodes.add(to);
      });
      pending.push({
        id: "cycle",
        kind: "cycle",
        referrerKeys: [...nodes],
        localSummary: "\u4E24\u4FA7\u65B0\u589E\u7684\u5F15\u7528\u5F62\u6210\u95ED\u73AF",
        incomingSummary: `\u6D89\u53CA\u6B65\u9AA4\uFF1A${[...nodes].join("\u3001")}`
      });
    }
    return pending;
  }
  danglingKeepFor(target, resolutions) {
    let found = false;
    resolutions.forEach((value, id) => {
      if (id.startsWith("dangling:") && id.endsWith(`:${target}`) && value === "keep") found = true;
    });
    return found;
  }
  cyclicNewEdges(resolutions) {
    const edges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew && this.survivingKeys(resolutions).has(edge.to));
    return cyclicEdges(edges.map((edge) => [edge.from, edge.to]));
  }
  /**
   * 生成合并后的完整文档。
   * 仍有未裁决条目时抛错——调用方据此保证“中途失败不写入任何内容”。
   */
  buildMerged(local, resolutions, createId2, nowIso) {
    const unresolved = this.listPending(resolutions);
    if (unresolved.length) {
      throw new Error(`\u8FD8\u6709 ${unresolved.length} \u9879\u5F85\u5904\u7406\uFF0C\u65E0\u6CD5\u786E\u8BA4\u5408\u5E76`);
    }
    const chosen = this.chosenSteps(resolutions);
    const alive = new Set(chosen.map((item) => item.key));
    const droppedEdges = /* @__PURE__ */ new Set();
    const cycleDecision = resolutions.get("cycle");
    if (cycleDecision) {
      const allEdges = this.effectiveEdges(resolutions).filter((edge) => edge.isNew);
      let candidates = allEdges.filter(
        (edge) => cycleDecision === "break-local" ? edge.inLocal && !edge.inIncoming : edge.inIncoming && !edge.inLocal
      );
      let cyclic = cyclicEdges(
        allEdges.filter((edge) => alive.has(edge.to)).map((edge) => [edge.from, edge.to])
      );
      candidates.forEach((edge) => {
        if (cyclic.has(`${edge.from}\u2192${edge.to}`)) droppedEdges.add(`${edge.from}\u2192${edge.to}`);
      });
      const stillCyclic = () => cyclicEdges(
        allEdges.filter((edge) => alive.has(edge.to) && !droppedEdges.has(`${edge.from}\u2192${edge.to}`)).map((edge) => [edge.from, edge.to])
      );
      cyclic = stillCyclic();
      if (cyclic.size) {
        allEdges.filter(
          (edge) => cycleDecision === "break-local" ? edge.inLocal : edge.inIncoming
        ).forEach((edge) => {
          if (cyclic.has(`${edge.from}\u2192${edge.to}`)) droppedEdges.add(`${edge.from}\u2192${edge.to}`);
          cyclic = stillCyclic();
        });
      }
    }
    const keyToMergedId = /* @__PURE__ */ new Map();
    const usedIds = /* @__PURE__ */ new Set();
    chosen.forEach(({ key, step: step2 }) => {
      let id = step2.id;
      if (usedIds.has(id)) id = createId2("step");
      usedIds.add(id);
      keyToMergedId.set(key, id);
    });
    const steps = chosen.map(({ key, origin, step: step2 }) => {
      const side = origin === "local" ? this.localSide : this.incomingSide;
      const references = [];
      sideRefTokens(step2, side).forEach((token, index) => {
        if (droppedEdges.has(`${key}\u2192${token}`)) return;
        if (resolutions.get(`dangling:${key}:${token}`) === "delete") return;
        if (keyToMergedId.has(token)) references.push(keyToMergedId.get(token));
        else if (!this.isKnownKey(token)) references.push(step2.references[index] ?? token);
      });
      return { ...structuredClone(step2), id: keyToMergedId.get(key), references: [...new Set(references)] };
    });
    const versionMap = /* @__PURE__ */ new Map();
    [...local.versions, ...this.baseVersions].forEach((version) => {
      if (!versionMap.has(version.id)) versionMap.set(version.id, structuredClone(version));
    });
    const versions = [...versionMap.values()].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
    const maxKeySeq = Math.max(0, ...[...keyToMergedId.keys()].map((key) => Number(key.slice(1)) || 0));
    return {
      ...structuredClone(local),
      goal: this.chosenGoal(resolutions),
      symbols: this.chosenSymbols(resolutions),
      steps,
      versions,
      stepSeq: Math.max(local.stepSeq ?? 0, this.incoming.stepSeq ?? 0, maxKeySeq),
      updatedAt: nowIso
    };
  }
};
function cyclicEdges(edges) {
  const graph = /* @__PURE__ */ new Map();
  edges.forEach(([from, to]) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push(to);
    if (!graph.has(to)) graph.set(to, []);
  });
  let index = 0;
  const indices = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const component = /* @__PURE__ */ new Map();
  let componentCount = 0;
  const strongConnect = (node) => {
    indices.set(node, index);
    low.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    (graph.get(node) ?? []).forEach((next) => {
      if (!indices.has(next)) {
        strongConnect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), indices.get(next)));
      }
    });
    if (low.get(node) === indices.get(node)) {
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.set(member, componentCount);
      } while (member !== node);
      componentCount += 1;
    }
  };
  graph.forEach((_, node) => {
    if (!indices.has(node)) strongConnect(node);
  });
  const componentSize = /* @__PURE__ */ new Map();
  component.forEach((c) => componentSize.set(c, (componentSize.get(c) ?? 0) + 1));
  const result = /* @__PURE__ */ new Set();
  edges.forEach(([from, to]) => {
    const c = component.get(from);
    if (component.get(to) === c && (from === to || (componentSize.get(c) ?? 0) > 1)) {
      result.add(`${from}\u2192${to}`);
    }
  });
  return result;
}
function createMergeSession(local, bundle) {
  return new MergeSession(local, normalizeBundle(bundle));
}
function buildBundle(document, baseline, nowIso) {
  return {
    format: "sologsb-proof-bundle",
    version: 1,
    exportedAt: nowIso,
    docId: document.id,
    title: document.title,
    baselineId: baseline.id,
    steps: structuredClone(document.steps),
    goal: document.goal,
    symbols: structuredClone(document.symbols),
    stepSeq: document.stepSeq,
    versions: structuredClone(document.versions)
  };
}

// scripts/merge-test.ts
var passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  \u2713 ${name}`);
}
function step(id, key, patch = {}) {
  return {
    id,
    key,
    type: "derivation",
    statement: `stmt-${key}`,
    rule: "\u7B49\u5F0F\u53D8\u5F62",
    references: [],
    note: "",
    counterexample: "",
    alternative: "",
    ...patch
  };
}
function versionOf(doc, id, name = "\u57FA\u7EBF") {
  return { id, name, createdAt: "2026-09-01T00:00:00.000Z", steps: structuredClone(doc.steps), goal: doc.goal, symbols: structuredClone(doc.symbols) };
}
function makeDoc(steps, symbols = { x: "X" }, goal = "G0", stepSeq) {
  const seq = stepSeq ?? Math.max(0, ...steps.map((s) => Number(s.key.slice(1)) || 0));
  return {
    id: "doc-1",
    title: "\u6D4B\u8BD5\u7A3F",
    author: "\u672C\u5730",
    goal,
    symbols,
    steps,
    versions: [],
    stepSeq: seq,
    updatedAt: "2026-10-01T00:00:00.000Z"
  };
}
function exportFrom(doc, baselineId = "v-base") {
  const versions = doc.versions.some((v) => v.id === baselineId) ? doc.versions : [versionOf(doc, baselineId), ...doc.versions];
  const withVersions = { ...doc, versions };
  const baseline = versions.find((v) => v.id === baselineId);
  return buildBundle(withVersions, baseline, "2026-10-02T00:00:00.000Z");
}
function autoResolve(session, extra = {}) {
  const resolutions = new Map(Object.entries(extra));
  const pending = session.listPending(resolutions);
  if (pending.length) {
    throw new Error(`\u610F\u5916\u7684\u5F85\u5904\u7406\u9879\uFF1A
${pending.map((p) => `${p.id} (${p.kind})`).join("\n")}`);
  }
  return resolutions;
}
var createId = (prefix) => `${prefix}-new-${Math.random().toString(36).slice(2, 8)}`;
{
  const base = makeDoc([step("a", "S1"), step("b", "S2")]);
  const remote = makeDoc([step("a", "S1"), step("b", "S2", { statement: "stmt-S2-remote" })]);
  const local = makeDoc([step("a", "S1", { statement: "stmt-S1-local" }), step("b", "S2")]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  const merged = session.buildMerged(local, autoResolve(session), createId, "now");
  test("\u5355\u4FA7\u4FEE\u6539\u81EA\u52A8\u63A5\u6536\uFF1A\u4E24\u4FA7\u6539\u52A8\u5408\u5E76\u4E14\u65E0\u5F85\u5904\u7406", () => {
    import_node_assert.default.equal(merged.steps.length, 2);
    import_node_assert.default.equal(merged.steps.find((s) => s.key === "S1").statement, "stmt-S1-local");
    import_node_assert.default.equal(merged.steps.find((s) => s.key === "S2").statement, "stmt-S2-remote");
  });
}
{
  const base = makeDoc([step("a", "S1", { statement: "v0" })]);
  const local = makeDoc([step("a", "S1", { statement: "local" })]);
  const remote = makeDoc([step("a", "S1", { statement: "remote" })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u4E24\u4FA7\u540C\u6539\u4E00\u6B65\uFF1A\u5217\u4E3A\u5F85\u5904\u7406\uFF0C\u672A\u88C1\u51B3\u65F6\u786E\u8BA4\u5931\u8D25\u4E14\u4E0D\u4EA7\u51FA\u7ED3\u679C", () => {
    import_node_assert.default.equal(session.listPending(/* @__PURE__ */ new Map()).length, 1);
    import_node_assert.default.equal(session.listPending(/* @__PURE__ */ new Map())[0].kind, "step");
    import_node_assert.default.throws(() => session.buildMerged(local, /* @__PURE__ */ new Map(), createId, "now"), /待处理/);
  });
  test("\u88C1\u51B3\u4FDD\u7559\u672C\u5730 / \u5BFC\u5165\u4FA7\u540E\u53EF\u786E\u8BA4", () => {
    const r1 = autoResolve(session, { "step:S1": "keep-local" });
    import_node_assert.default.equal(session.buildMerged(local, r1, createId, "now").steps[0].statement, "local");
    const r2 = autoResolve(session, { "step:S1": "keep-incoming" });
    import_node_assert.default.equal(session.buildMerged(local, r2, createId, "now").steps[0].statement, "remote");
  });
}
{
  const baseSteps = [step("a", "S1"), step("b", "S2")];
  const base = makeDoc(baseSteps);
  const localSteps = [step("a", "S1"), step("b", "S2"), step("c", "S3", { references: ["b"] })];
  const local = makeDoc(localSteps, { x: "X" }, "G0", 3);
  const remoteSteps = [step("a", "S1")];
  const remote = makeDoc(remoteSteps);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u5220\u6B65\u9AA4 \xD7 \u65B0\u589E\u5F15\u7528\u649E\u8F66\uFF1A\u5217\u4E3A dangling \u5F85\u5904\u7406", () => {
    const pending = session.listPending(/* @__PURE__ */ new Map());
    import_node_assert.default.equal(pending.length, 1);
    import_node_assert.default.equal(pending[0].kind, "dangling");
    import_node_assert.default.equal(pending[0].targetKey, "S2");
  });
  test("\u9009\u62E9\u5220\u5F15\u7528\uFF1A\u6B63\u5F0F\u8BC1\u660E\u4E2D\u6CA1\u6709\u65AD\u6389\u7684\u4F9D\u636E", () => {
    const r = autoResolve(session, { "dangling:S3:S2": "delete" });
    const merged = session.buildMerged(local, r, createId, "now");
    import_node_assert.default.deepEqual(merged.steps.find((s) => s.key === "S3").references, []);
    import_node_assert.default.equal(merged.steps.find((s) => s.key === "S2"), void 0);
  });
  test("\u9009\u62E9\u4FDD\u7559\u4F9D\u636E\uFF1AS2 \u4E0E S3 \u7684\u5F15\u7528\u90FD\u6062\u590D", () => {
    const r = autoResolve(session, { "dangling:S3:S2": "keep" });
    const merged = session.buildMerged(local, r, createId, "now");
    import_node_assert.default.ok(merged.steps.find((s) => s.key === "S2"));
    const s3 = merged.steps.find((s) => s.key === "S3");
    import_node_assert.default.equal(s3.references.length, 1);
    import_node_assert.default.equal(merged.steps.find((s) => s.id === s3.references[0]).key, "S2");
  });
}
{
  const base = makeDoc([step("a", "S1", { statement: "v0" })]);
  const local = makeDoc([step("a", "S1", { statement: "v0" })]);
  const remote = makeDoc([step("a", "S1", { statement: "remote-edit" })]);
  const localDeleted = makeDoc([]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(localDeleted, bundle);
  test("\u672C\u5730\u5220 \xD7 \u5BFC\u5165\u4FA7\u6539\uFF1Amoddelete \u5F85\u5904\u7406\uFF0C\u9ED8\u8BA4\u4E0D\u8BA9\u6539\u52A8\u4E22\u5931", () => {
    const pending = session.listPending(/* @__PURE__ */ new Map());
    import_node_assert.default.equal(pending[0].kind, "step-moddelete");
    import_node_assert.default.equal(pending[0].stepKey, "S1");
  });
  test("\u786E\u8BA4\u5220\u9664\u540E\u6B65\u9AA4\u6D88\u5931\uFF1B\u786E\u8BA4\u4FDD\u7559\u540E\u6539\u52A8\u8FDB\u5165", () => {
    const rDel = autoResolve(session, { "moddelete-step:S1": "delete" });
    import_node_assert.default.equal(session.buildMerged(localDeleted, rDel, createId, "now").steps.length, 0);
    const rKeep = autoResolve(session, { "moddelete-step:S1": "keep" });
    const merged = session.buildMerged(localDeleted, rKeep, createId, "now");
    import_node_assert.default.equal(merged.steps[0].statement, "remote-edit");
  });
  void local;
}
{
  const base = makeDoc([step("a", "S1")], { common: "\u5171\u540C", onlyLocal: "L0", onlyRemote: "R0", changed: "base" });
  const local = makeDoc(
    [step("a", "S1"), step("l", "S2", { statement: "s2" })],
    { common: "\u5171\u540C", onlyLocal: "L0", changed: "local-edit", newLocal: "NL" },
    "G0",
    2
  );
  const remote = makeDoc(
    [step("a", "S1")],
    { common: "\u5171\u540C", onlyLocal: "L0", onlyRemote: "R0", changed: "remote-edit", newRemote: "NR" }
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u7B26\u53F7\u5355\u4FA7\u589E\u6539\u81EA\u52A8\u63A5\u6536\uFF0C\u53CC\u4FA7\u540C\u6539\u5217\u5F85\u5904\u7406", () => {
    const pending = session.listPending(/* @__PURE__ */ new Map());
    import_node_assert.default.equal(pending.filter((p) => p.kind === "symbol" && p.symbol === "changed").length, 1);
    import_node_assert.default.equal(session.symbolStatus.get("onlyRemote"), "deleted-local");
  });
  test("\u88C1\u51B3\u540E\u7B26\u53F7\u8868\u5305\u542B\uFF1A\u5171\u540C + \u5355\u4FA7\u65B0\u589E + \u9009\u4E2D\u7684\u6539\u52A8\uFF1B\u81EA\u52A8\u5220\u9664\u9879\u79FB\u9664", () => {
    const r = autoResolve(session, { "symbol:changed": "keep-incoming" });
    const symbols = session.chosenSymbols(r);
    import_node_assert.default.deepEqual(symbols, {
      common: "\u5171\u540C",
      onlyLocal: "L0",
      changed: "remote-edit",
      newLocal: "NL",
      newRemote: "NR"
    });
  });
}
{
  const common = [step("a", "S1", { statement: "same-1" }), step("b", "S2", { statement: "same-2" })];
  const local = makeDoc([...common, step("c", "S3", { statement: "local-new" })], {}, "G0", 3);
  const remoteSteps = [...common, step("d", "S4", { statement: "remote-new" })];
  const remote = makeDoc(remoteSteps, {}, "G0", 4);
  const bundle = normalizeBundle({
    format: "sologsb-proof-bundle",
    version: 1,
    exportedAt: "now",
    docId: "doc-1",
    title: "\u65E7\u7A3F",
    baselineId: null,
    steps: remoteSteps,
    goal: "G0",
    symbols: {},
    stepSeq: 4,
    versions: []
  });
  void remote;
  const session = createMergeSession(local, bundle);
  test("\u65E0\u5FEB\u7167\u5BFC\u5165\uFF1A\u6807\u8BB0\u4E3A legacy\uFF0C\u76F8\u540C\u5185\u5BB9\u4E0D\u4EA7\u751F\u51B2\u7A81", () => {
    import_node_assert.default.equal(session.legacy, true);
    import_node_assert.default.equal(session.stepStatus.get("S1"), "unchanged");
    import_node_assert.default.equal(session.stepStatus.get("S3"), "local-only");
    import_node_assert.default.equal(session.stepStatus.get("S4"), "incoming-only");
  });
  test("\u53CC\u65B9\u5404\u81EA\u65B0\u589E\u7684\u6B65\u9AA4\u90FD\u8FDB\u5165\u5408\u5E76\u7A3F", () => {
    const merged = session.buildMerged(local, autoResolve(session), createId, "now");
    const keys = merged.steps.map((s) => s.key).sort();
    import_node_assert.default.deepEqual(keys, ["S1", "S2", "S3", "S4"]);
  });
}
{
  const local = makeDoc([step("a", "S1", { statement: "L" })]);
  const remote = makeDoc([step("a", "S1", { statement: "R" })]);
  const bundle = normalizeBundle({
    format: "sologsb-proof-bundle",
    version: 1,
    exportedAt: "now",
    docId: "doc-1",
    title: "\u65E7\u7A3F",
    baselineId: null,
    steps: remote.steps,
    goal: "G0",
    symbols: {},
    stepSeq: 1,
    versions: []
  });
  const session = createMergeSession(local, bundle);
  test("\u65E0\u5FEB\u7167\u4E14\u540C\u7F16\u53F7\u6B65\u9AA4\u5185\u5BB9\u4E0D\u540C\uFF1A\u53CC\u4FA7\u51B2\u7A81\uFF0C\u9700\u88C1\u51B3", () => {
    import_node_assert.default.equal(session.stepStatus.get("S1"), "changed-both");
    import_node_assert.default.equal(session.listPending(/* @__PURE__ */ new Map()).length, 1);
  });
}
{
  const base = makeDoc([step("a", "S1")]);
  const local = { ...makeDoc([step("a", "S1")]), versions: [versionOf(base, "v-shared", "\u5171\u540C\u65E7\u5FEB\u7167")] };
  const remote = {
    ...makeDoc([step("a", "S1", { statement: "remote" })]),
    versions: [versionOf(base, "v-base"), versionOf(base, "v-shared", "\u5171\u540C\u65E7\u5FEB\u7167"), { ...versionOf(base, "v-r2", "\u8FDC\u7AEF\u5FEB\u7167"), createdAt: "2026-09-02T00:00:00.000Z" }]
  };
  const bundle = exportFrom(remote);
  const session = createMergeSession(local, bundle);
  const r = autoResolve(session);
  test("\u786E\u8BA4\u540E\u57FA\u7EBF\u4E0E\u8FDC\u7AEF\u65E7\u5FEB\u7167\u5199\u5165\uFF0C\u5DF2\u6709\u7684\u5171\u540C\u5FEB\u7167\u4E0D\u91CD\u590D", () => {
    const merged = session.buildMerged(local, r, createId, "now");
    const ids = merged.versions.map((v) => v.id);
    import_node_assert.default.deepEqual([...new Set(ids)].sort(), ids.sort());
    import_node_assert.default.ok(ids.includes("v-base"));
    import_node_assert.default.ok(ids.includes("v-r2"));
    import_node_assert.default.equal(ids.filter((id) => id === "v-shared").length, 1);
  });
  test("\u540C\u4E00\u4EFD\u88C1\u51B3\u91CD\u590D\u786E\u8BA4\uFF08\u91CD\u8BD5\uFF09\u7ED3\u679C\u5E42\u7B49", () => {
    const merged1 = session.buildMerged(local, r, createId, "now");
    const merged2 = session.buildMerged(local, r, createId, "now");
    import_node_assert.default.equal(merged1.versions.length, merged2.versions.length);
    import_node_assert.default.deepEqual(merged1.steps.map((s) => [s.key, s.statement]), merged2.steps.map((s) => [s.key, s.statement]));
  });
}
{
  const base = makeDoc([step("same", "S1")]);
  const local = makeDoc(
    [step("same", "S1"), step("dup", "S2", { statement: "local-S2", references: ["same"] })],
    {},
    "G0",
    2
  );
  const remote = makeDoc(
    [step("same", "S1"), step("dup", "S2", { statement: "remote-S2" }), step("other", "S3", { references: ["dup"] })],
    {},
    "G0",
    3
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u4E24\u4FA7\u65B0\u589E\u540C id \u6B65\u9AA4\uFF1Aid \u91CD\u65B0\u5206\u914D\u4E14\u5404\u81EA\u5F15\u7528\u6B63\u786E\uFF08S2 \u53CC\u4FA7\u51B2\u7A81\u9700\u88C1\u51B3\uFF09", () => {
    import_node_assert.default.equal(session.stepStatus.get("S2"), "changed-both");
    const r = autoResolve(session, { "step:S2": "keep-local" });
    const merged = session.buildMerged(local, r, createId, "now");
    const ids = merged.steps.map((s) => s.id);
    import_node_assert.default.equal(new Set(ids).size, ids.length);
    const s3 = merged.steps.find((s) => s.key === "S3");
    const s2 = merged.steps.find((s) => s.key === "S2");
    import_node_assert.default.equal(merged.steps.find((s) => s.id === s3.references[0]).key, s2.key);
    import_node_assert.default.equal(s2.statement, "local-S2");
  });
}
{
  const base = makeDoc([step("a", "S1")], {}, "G-base");
  const local = makeDoc([step("a", "S1")], {}, "G-base");
  const remote = makeDoc([step("a", "S1")], {}, "G-remote");
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u76EE\u6807\u5355\u4FA7\u4FEE\u6539\u81EA\u52A8\u63A5\u6536", () => {
    const r = autoResolve(session);
    import_node_assert.default.equal(session.buildMerged(local, r, createId, "now").goal, "G-remote");
  });
  const local2 = makeDoc([step("a", "S1")], {}, "G-local");
  const session2 = createMergeSession(local2, bundle);
  test("\u76EE\u6807\u53CC\u4FA7\u4FEE\u6539\u5217\u4E3A\u5F85\u5904\u7406", () => {
    import_node_assert.default.equal(session2.listPending(/* @__PURE__ */ new Map())[0].kind, "goal");
  });
}
{
  const base = makeDoc([step("a", "S1"), step("b", "S2"), step("c", "S3")]);
  const local = makeDoc([step("a", "S1"), step("b", "S2"), step("c", "S3", { statement: "local-edit" })], {}, "G0", 3);
  const remote = makeDoc(
    [step("a", "S1"), step("b", "S2", { references: ["a"] }), step("c", "S3")]
  );
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u5F15\u7528\u5728\u8FDC\u7AEF\u5355\u4FA7\u65B0\u589E\u65F6\u81EA\u52A8\u5E76\u5165\uFF0C\u5408\u5E76\u540E\u5F15\u7528\u6307\u5411\u91CD\u65B0\u5206\u914D\u7684\u6B63\u786E id", () => {
    const merged = session.buildMerged(local, autoResolve(session), createId, "now");
    const byKey = new Map(merged.steps.map((s) => [s.key, s]));
    import_node_assert.default.deepEqual(byKey.get("S2").references, [byKey.get("S1").id]);
    import_node_assert.default.deepEqual(byKey.get("S3").references, []);
    import_node_assert.default.equal(byKey.get("S3").statement, "local-edit");
  });
}
{
  const base = makeDoc([step("a", "S1")], { x: "X" }, "G");
  const bundle = exportFrom({ ...base, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(base, bundle);
  test("\u65E0\u53D8\u5316\u65F6\u96F6\u5F85\u5904\u7406\u3001\u96F6\u6539\u52A8", () => {
    const merged = session.buildMerged(base, autoResolve(session), createId, "now");
    import_node_assert.default.equal(merged.steps.length, 1);
    import_node_assert.default.equal(merged.goal, "G");
    import_node_assert.default.deepEqual(merged.symbols, { x: "X" });
  });
}
{
  const base = makeDoc([step("a", "S1"), step("b", "S2")]);
  const local = makeDoc([step("a", "S1", { references: ["b"] }), step("b", "S2")]);
  const remote = makeDoc([step("a", "S1"), step("b", "S2", { references: ["a"] })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u65B0\u589E\u5F15\u7528\u4E24\u4FA7\u6210\u73AF\uFF1A\u5217\u4E3A cycle \u5F85\u5904\u7406\uFF0C\u4E0D\u88C1\u51B3\u4E0D\u80FD\u786E\u8BA4", () => {
    const pending = session.listPending(/* @__PURE__ */ new Map());
    import_node_assert.default.equal(pending[pending.length - 1].kind, "cycle");
    import_node_assert.default.throws(() => session.buildMerged(local, /* @__PURE__ */ new Map(), createId, "now"), /待处理/);
  });
  test("\u65AD\u5F00\u672C\u5730\u65B0\u589E\u8FB9\u540E\u73AF\u6D88\u5931\uFF0C\u8FDC\u7AEF\u8FB9\u4FDD\u7559", () => {
    const r = autoResolve(session, { cycle: "break-local" });
    const merged = session.buildMerged(local, r, createId, "now");
    const byKey = new Map(merged.steps.map((s) => [s.key, s]));
    import_node_assert.default.deepEqual(byKey.get("S1").references, []);
    import_node_assert.default.deepEqual(byKey.get("S2").references, [byKey.get("S1").id]);
  });
}
{
  const base = makeDoc([step("a", "S1", { references: ["b"] }), step("b", "S2")]);
  const local = makeDoc([step("a", "S1", { references: ["b"] }), step("b", "S2")]);
  const remote = makeDoc([step("a", "S1", { references: [] })]);
  const bundle = exportFrom({ ...remote, versions: [versionOf(base, "v-base")] });
  const session = createMergeSession(local, bundle);
  test("\u65E7\u5F15\u7528\u968F\u88AB\u5220\u6B65\u9AA4\u81EA\u52A8\u6E05\u7406\uFF1A\u65E0 dangling \u5F85\u5904\u7406\uFF0C\u7ED3\u679C\u65E0\u65AD\u94FE", () => {
    const pending = session.listPending(/* @__PURE__ */ new Map());
    import_node_assert.default.equal(pending.length, 0);
    const merged = session.buildMerged(local, autoResolve(session), createId, "now");
    import_node_assert.default.equal(merged.steps.length, 1);
    import_node_assert.default.deepEqual(merged.steps[0].references, []);
  });
}
{
  const doc = makeDoc([step("a", "S1")], { x: "X" }, "G");
  const withBaseline = { ...doc, versions: [versionOf(doc, "v-base")] };
  const bundle = buildBundle(withBaseline, withBaseline.versions[0], "now");
  const session = createMergeSession(doc, bundle);
  test("\u5BFC\u51FA\u5305\u6309\u57FA\u7EBF\u5BFC\u5165\u539F\u6587\u6863\uFF1A\u5168\u90E8 unchanged \u4E14\u57FA\u7EBF\u5FEB\u7167\u5728\u5408\u5E76\u7A3F\u4E2D", () => {
    const merged = session.buildMerged(doc, autoResolve(session), createId, "now");
    import_node_assert.default.equal(session.stepRows.every((r) => r.status === "unchanged"), true);
    import_node_assert.default.ok(merged.versions.some((v) => v.id === "v-base"));
  });
}
console.log(`
\u5168\u90E8 ${passed} \u7EC4\u6D4B\u8BD5\u901A\u8FC7`);
