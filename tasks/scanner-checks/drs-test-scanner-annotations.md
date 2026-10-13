---
name: drs-test-scanner-annotations
description: Test skill for checking whether one layer can hold several annotations written by Plugin API code in Figma's agent. Use only when the user runs /drs-test-scanner-annotations.
---

Run the script below with `evaluate_script`. It works on the one selected layer. Scripts can't see the user's selection, so first replace `'SELECTED_NODE_ID'` in the first line with that layer's node id, as a quoted string. That is the only change allowed: run everything else exactly as written. It adds two test annotations beside the ones already there, reads them back, then removes only its own and leaves the layer as it found it. If you can't run it, reply `CANNOT RUN` and the reason in one sentence.

```js
const node = await figma.getNodeByIdAsync('SELECTED_NODE_ID');
if (!node || !('annotations' in node)) return 'SELECT ONE FRAME, INSTANCE, COMPONENT OR TEXT LAYER';

const plain = (list) => list.map(a => {
  const o = {};
  if (a.labelMarkdown) o.labelMarkdown = a.labelMarkdown; else if (a.label) o.label = a.label;
  if (a.properties && a.properties.length) o.properties = a.properties;
  if (a.categoryId) o.categoryId = a.categoryId;
  return o;
});
const out = { node: { id: node.id, name: node.name, type: node.type } };
out.before = plain(node.annotations);

const cats = await figma.annotations.getAnnotationCategoriesAsync();
const cat = cats.find(c => c.label === 'drs-test') || await figma.annotations.addAnnotationCategoryAsync({ label: 'drs-test', color: 'orange' });
out.category = { id: cat.id, label: cat.label };

const mine = [
  { labelMarkdown: '**drs-test 1**: first test annotation', categoryId: cat.id },
  { labelMarkdown: '**drs-test 2**: second test annotation', categoryId: cat.id },
];
try { node.annotations = [...plain(node.annotations), ...mine]; out.writeError = null; }
catch (e) { out.writeError = String((e && e.message) || e); }
out.afterWrite = plain(node.annotations);

try { node.annotations = plain(node.annotations).filter(a => a.categoryId !== cat.id); out.cleanupError = null; }
catch (e) { out.cleanupError = String((e && e.message) || e); }
out.afterCleanup = plain(node.annotations);

try { if (typeof cat.remove === 'function') { cat.remove(); out.categoryRemoved = true; } else out.categoryRemoved = 'no remove()'; }
catch (e) { out.categoryRemoved = String((e && e.message) || e); }

out.originalKept = JSON.stringify(out.afterCleanup) === JSON.stringify(out.before);
return JSON.stringify(out, null, 2);
```

Reply with:

1. The script's full output, exactly as it came back.
2. The node id you used, and whether you changed anything else. If you did, show the change. Paste the whole output, even if it's long.
