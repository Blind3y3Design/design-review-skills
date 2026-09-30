---
name: drs-test-scanner-read
description: Test skill for checking what a fixed Plugin API script can read about the selection in Figma's agent. Use only when the user runs /drs-test-scanner-read.
---

Run the script below with `evaluate_script`, exactly as written. It reads the selected layers and changes nothing in the file. If the tool needs a different wrapper, for example a top-level `return` instead of the async function, change only the wrapper and say exactly what you changed. If you can't run it at all, reply `CANNOT RUN` and the reason in one sentence.

```js
(async () => {
  const out = { selection: [], teamLibrary: null };

  // C2: does figma.teamLibrary work here?
  let libCols = [];
  try {
    libCols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    out.teamLibrary = { ok: true, collections: libCols.length, sample: libCols.slice(0, 10).map(c => ({ key: c.key, name: c.name, libraryName: c.libraryName })) };
  } catch (e) {
    out.teamLibrary = { ok: false, error: String((e && e.message) || e) };
  }

  const bindingsOf = async (n) => {
    const found = [];
    const bv = n.boundVariables || {};
    for (const field of Object.keys(bv)) {
      const aliases = Array.isArray(bv[field]) ? bv[field] : [bv[field]];
      for (const a of aliases) {
        if (!a || !a.id) continue;
        const v = await figma.variables.getVariableByIdAsync(a.id);
        const col = v ? await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId) : null;
        const lib = col ? libCols.find(c => c.key === col.key) : null;
        found.push({ field, variable: v && v.name, remote: v && v.remote, collection: col && col.name, collectionKey: col && col.key, libraryName: lib ? lib.libraryName : null });
      }
    }
    return found;
  };

  for (const node of figma.currentPage.selection) {
    const r = { id: node.id, name: node.name, type: node.type };

    // C1: detachedInfo, read directly
    r.detachedInfo = 'detachedInfo' in node ? node.detachedInfo : 'NOT_AVAILABLE_ON_THIS_TYPE';

    // C2: variable bindings on the layer and up to 20 descendants
    const layers = [node, ...('findAll' in node ? node.findAll(() => true).slice(0, 20) : [])];
    r.bindings = [];
    for (const n of layers) for (const b of await bindingsOf(n)) r.bindings.push({ layer: n.name, ...b });

    // C3: overrides, split into component-property changes and direct overrides
    if (node.type === 'INSTANCE') {
      const main = await node.getMainComponentAsync();
      r.mainComponent = main ? { name: main.name, key: main.key, remote: main.remote } : null;
      r.componentProperties = node.componentProperties;
      r.overrides = [];
      for (const o of node.overrides) {
        const target = await figma.getNodeByIdAsync(o.id);
        const refs = target && 'componentPropertyReferences' in target ? (target.componentPropertyReferences || {}) : {};
        r.overrides.push({
          layer: target ? target.name : o.id,
          fields: o.overriddenFields.map(f => ({
            field: f,
            kind: f === 'componentProperties' || refs[f] ? 'property' : 'direct',
          })),
        });
      }
    }
    out.selection.push(r);
  }
  return JSON.stringify(out, null, 2);
})()
```

Reply with:

1. The script's full output, exactly as it came back.
2. Whether you ran the script exactly as written. If you changed anything, show the change.
3. **C6:** the `set_custom_skill_preference` tool's description and parameters, as your tool list shows them. Don't call it.
