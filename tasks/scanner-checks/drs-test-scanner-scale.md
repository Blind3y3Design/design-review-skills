---
name: drs-test-scanner-scale
description: Test skill for checking how long a scan of a whole page takes in Figma's agent, and how much output one script call can return. Use only when the user runs /drs-test-scanner-scale.
---

This test has two parts. Run each script with `evaluate_script`, exactly as written. Neither changes anything in the file. If the tool needs a different wrapper, for example a top-level `return` instead of the async function, change only the wrapper and say exactly what you changed. If you can't run a script at all, reply `CANNOT RUN` and the reason in one sentence.

**Part 1: scan the current page.** It reads every layer on the page and reports counts and timings, not the facts themselves.

```js
(async () => {
  const t0 = Date.now();
  const nodes = figma.currentPage.findAll(() => true);
  const t1 = Date.now();
  let instances = 0, detached = 0, bound = 0, text = 0;
  const facts = [];
  for (const n of nodes) {
    const f = { id: n.id, t: n.type };
    if (n.type === 'INSTANCE') { instances++; const m = await n.getMainComponentAsync(); f.k = m ? m.key : null; }
    if ('detachedInfo' in n && n.detachedInfo) { detached++; f.d = n.detachedInfo.type; }
    if (n.boundVariables && Object.keys(n.boundVariables).length) { bound++; f.b = Object.keys(n.boundVariables); }
    if (n.type === 'TEXT') text++;
    facts.push(f);
  }
  const t2 = Date.now();
  return JSON.stringify({
    page: figma.currentPage.name, layers: nodes.length, instances, detached, bound, text,
    msFindAll: t1 - t0, msRead: t2 - t1, factsBytes: JSON.stringify(facts).length,
  }, null, 2);
})()
```

**Part 2: how much output comes back.** Run this script four times, setting `SIZE` to 10000, then 30000, then 60000, then 120000. Each output ends with a marker.

```js
(async () => {
  const SIZE = 10000;
  const marker = `END-OF-${SIZE}`;
  return 'x'.repeat(SIZE - marker.length) + marker;
})()
```

Reply with:

1. Part 1's full output, exactly as it came back.
2. For each `SIZE` in Part 2: the length of the output you received, and whether it ended with the marker `END-OF-<SIZE>`.
3. Whether you ran every script exactly as written. If you changed anything, show the change.
