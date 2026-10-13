# DRS Test Foundation rules

- Layer: Foundation

Rules written for the DRS Test Foundation library, for the design review smoke tests. `design-review-library` reads this from the Foundation layer's `Rules document` line; the format is the one its Layer rules section describes.

## Rules

### FS-1: Interactive components use the small radius

- Statement: Interactive components, buttons and anything that acts like one, use `radius/sm`.
- Locked: yes
- Applies to: components named `Button` or `Pill Button`, and anything that acts like one
- Preferred tokens: `radius/sm`

### FS-2: Buttons are 36 px high

- Statement: A button is 36 px high.
- Locked: no
- Applies to: `Test Foundation/Button`
- Size: height 36

### FS-3: Button fills may change where the design needs it

- Statement: A button's fill may differ from the action colour where the design needs it.
- Locked: no
- Applies to: `Test Foundation/Button` and its instances
- Allowed overrides: fill
