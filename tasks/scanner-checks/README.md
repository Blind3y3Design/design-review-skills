# Hands-on test: the facts the Design Scanner depends on

Throwaway test assets for [issue #21](https://github.com/Blind3y3Design/design-review-skills/issues/21). They aren't Review Skills. Each one carries a fixed Plugin API script and tells the agent to run it exactly as written, which also tests whether Figma's agent will run a supplied script instead of writing its own.

| File | Checks | Changes the file? |
|---|---|---|
| `drs-test-scanner-read.md` | C1 `detachedInfo`, C2 `figma.teamLibrary` and variable library names, C3 splitting overrides, C6 `set_custom_skill_preference` | No |
| `drs-test-scanner-annotations.md` | C4 several annotations on one layer | Adds two test annotations, then removes them |
| `drs-test-scanner-scale.md` | C5 how long a scan of a whole page takes, and how much output one call returns | No |

The results are recorded in the resolution comment on issue #21.
