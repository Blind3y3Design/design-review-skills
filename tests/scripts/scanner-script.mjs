// Takes a fixed script out of the Design Scanner's SKILL.md, as an agent copies it, for tests to run against a fake of the Plugin API.
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../../skills/design-review-scanner/SKILL.md', import.meta.url), 'utf8');

// The first js block in the `## <heading>` section, or undefined when there's none.
export const scriptUnder = (heading) => {
  const section = skill.split(/^## /m).find((s) => s.startsWith(heading));
  const block = section && /^```js\n([\s\S]*?)^```/m.exec(section);
  return block ? block[1] : undefined;
};

// Runs a script with top-level await and return, as the runtimes do.
export const AsyncFunction = (async () => {}).constructor;
