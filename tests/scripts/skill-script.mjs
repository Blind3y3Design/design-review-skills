// Takes a fixed script out of a design review skill's SKILL.md, as an agent copies it, for tests to run against a fake of the Plugin API.
import { readFileSync } from 'node:fs';

const skills = new Map();
const read = (name) => {
  if (!skills.has(name)) skills.set(name, readFileSync(new URL(`../../skills/${name}/SKILL.md`, import.meta.url), 'utf8'));
  return skills.get(name);
};

// The first js block in the `## <heading>` section of a skill (the Design Scanner by default), or undefined when there's none.
export const scriptUnder = (heading, skill = 'design-review-scanner') => {
  const section = read(skill).split(/^## /m).find((s) => s.startsWith(heading));
  const block = section && /^```js\n([\s\S]*?)^```/m.exec(section);
  return block ? block[1] : undefined;
};

// Runs a script with top-level await and return, as the runtimes do.
export const AsyncFunction = (async () => {}).constructor;
