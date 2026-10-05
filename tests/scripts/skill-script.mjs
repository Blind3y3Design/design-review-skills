// Takes a fixed script out of a design review skill's SKILL.md, as an agent copies it, for tests to run against a fake of the Plugin API.
import { readFileSync } from 'node:fs';

const skills = new Map();
const read = (name) => {
  if (!skills.has(name)) skills.set(name, readFileSync(new URL(`../../skills/${name}/SKILL.md`, import.meta.url), 'utf8'));
  return skills.get(name);
};

// The Design Scanner is two skills, each with the scripts for its own fact groups.
export const SCANNER_SKILLS = ['design-review-scanner', 'design-review-scanner-assets'];

// The first js block in the `## <heading>` section of a skill, or undefined when there's none. Without a skill, looks in the scanner skills
// and throws when both hold the heading, so a script is never read from the wrong one.
export const scriptUnder = (heading, skill) => {
  if (!skill) {
    const found = SCANNER_SKILLS.filter((name) => scriptUnder(heading, name) !== undefined);
    if (found.length > 1) throw new Error(`"${heading}" is in ${found.join(' and ')}`);
    return found.length ? scriptUnder(heading, found[0]) : undefined;
  }
  const section = read(skill).split(/^## /m).find((s) => s.startsWith(heading));
  const block = section && /^```js\n([\s\S]*?)^```/m.exec(section);
  return block ? block[1] : undefined;
};

// Runs a script with top-level await and return, as the runtimes do.
export const AsyncFunction = (async () => {}).constructor;
