# WCAG 2.2 criteria reference

- Name: WCAG 2.2 criteria reference
- Version: 0.3
- Covers: WCAG 2.2 and WCAG 2.1, Levels A and AA

A Reference Document for `design-review-accessibility`. For each WCAG success criterion it gives what a design-stage review needs: whether the criterion can be judged from a design, what triggers it, how to judge it with its thresholds, and its default Severity. The review skill holds only the procedure. Everything specific to a criterion lives here.

W3C publishes no split of criteria into what a design, a prototype or code can show. The groups below are this repo's own analysis ([issue #5](https://github.com/Blind3y3Design/design-review-skills/issues/5)) of the WCAG 2.2 and 2.1 Recommendations.

It holds:

- **Every WCAG 2.2 criterion at Levels A and AA,** 55 in all. A WCAG 2.2 AA review gives all 55 a Coverage entry, and a WCAG 2.2 A review the 31 at Level A.
- **The WCAG 2.1 changes.** A WCAG 2.1 AA review gives 50 criteria a Coverage entry, and a WCAG 2.1 A review 30.
- **Four AAA criteria that can be judged from a design,** used only as above-target checks.

A criterion that isn't listed here isn't judged.

## How an entry reads

Each criterion is a `###` heading with its number and name, then these lines:

- **Level:** A, AA or AAA.
- **Since:** the WCAG version that added it. A criterion applies to a target whose version is this or later, and whose level is this level or higher.
- **Removed:** only on an entry that has one, the version that removed it. The criterion applies only to earlier versions.
- **Group:** `static` (judged from layers and their values), `annotation/prototype` (judged when the annotation or prototype state exists), or `code` (never judged from a design: Coverage gives `needs-code`).
- **Facts:** the Design Facts groups it's judged from: `colourPairs`, `text`, `structure`, `components` or `annotations`. A part in brackets, such as `structure (target sizes)`, is the part of that group the criterion needs. `none` for `code` criteria.
- **Trigger:** what in the design brings the criterion into play. With no trigger in the scope, Coverage gives `not-applicable`. A trigger that names a **screen** means a frame at least 320 px wide and 320 px high, either on the page or directly inside a Figma section. A smaller frame, such as a card, a component or a set of variants, isn't a screen.
- **Needs:** for `annotation/prototype` criteria, what must exist before it can be judged: `annotation: <kind>` or `state: <kind>`, where a state is a prototype, variant or frame showing the behaviour. Criteria that need the same annotation name the same kind. `none` for the other groups.
- **Markers:** for criteria judged only in a section explicitly marked for them, what marks one: the criterion number, a marker word, or a variant value. The first marker word is the section title to suggest when there's none. `none` otherwise.
- **Default Severity:** where a failure starts. Level A starts at serious, Level AA at moderate, and AAA at advisory.
- **W3C:** the criterion in the WCAG 2.2 Recommendation, used as a Finding's `standard.url` at a WCAG 2.2 target. "WCAG 2.1 changes" gives the links for a WCAG 2.1 target.

Under the lines, **How to judge** gives the test and its thresholds, what fails, the exceptions, what the evidence and fix say, and the Root Cause when it's a source other than the failing layer.

## Criteria

### 1.1.1 Non-text Content

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: images, icons, charts or other non-text content, including icon-only controls. A part of a control that has a visible text label, such as a checkbox's check mark, doesn't trigger it
- Needs: annotation: text alternative
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#non-text-content

**How to judge.** Each piece of non-text content has an annotated text alternative that serves the same purpose, or an annotation marking it decorative. An icon-only control's alternative says what the control does.

- **Fails:** an alternative that doesn't convey what the image does, such as a file name or "image", or a meaningful image marked decorative.
- **Exceptions:** a CAPTCHA, a test, a sensory experience or media under 1.2 needs only an alternative that identifies it.
- **Fix:** annotate the text alternative, or mark the image decorative.

### 1.2.1 Audio-only and Video-only (Prerecorded)

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: prerecorded audio-only or video-only media
- Needs: annotation: media alternatives
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#audio-only-and-video-only-prerecorded

**How to judge.** Audio-only media has an annotated transcript. Video-only media has a transcript or an audio track that gives the same information. Media that is itself an alternative to text on the screen, and labelled as one, is exempt. Fix: annotate the transcript or audio track.

### 1.2.2 Captions (Prerecorded)

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: prerecorded video with sound
- Needs: annotation: media alternatives
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#captions-prerecorded

**How to judge.** An annotation says the video has synchronised captions covering speech and meaningful sounds. A visible captions control supports this, but isn't enough alone. Media that is an alternative to text, and labelled as one, is exempt. Fix: annotate the captions.

### 1.2.3 Audio Description or Media Alternative (Prerecorded)

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: prerecorded video with sound
- Needs: annotation: media alternatives
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#audio-description-or-media-alternative-prerecorded

**How to judge.** An annotation gives an audio description of the visual content, or a full text alternative that includes what's shown. Media that is an alternative to text, and labelled as one, is exempt. Fix: annotate the audio description or text alternative.

### 1.2.4 Captions (Live)

- Level: AA
- Since: 2.0
- Group: code
- Facts: none
- Trigger: live video with sound
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#captions-live

**How to judge.** Code only: a test of the running product checks that live media is captioned.

### 1.2.5 Audio Description (Prerecorded)

- Level: AA
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: prerecorded video with sound
- Needs: annotation: media alternatives
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#audio-description-prerecorded

**How to judge.** An annotation gives an audio description of the visual content. A text alternative alone doesn't meet this criterion. When the soundtrack already carries everything the video shows, no description is needed, and the evidence says so. Fix: annotate the audio description.

### 1.3.1 Info and Relationships

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: visual structure: headings, lists, tables, groups of form controls, or page regions
- Needs: annotation: headings and structure
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#info-and-relationships

**How to judge.** The annotations match the structure the design shows: each visual heading is a heading, with a level that follows the visual hierarchy; lists are lists; a data table has its header cells; a group of related controls has its group label; regions are landmarks.

- **Fails:** a visual heading annotated as body text, heading levels that contradict the visual hierarchy, or a data table with no header cells.
- **Fix:** annotate the missing or mismatched structure.

### 1.3.2 Meaningful Sequence

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content laid out so it could be read in more than one order: two or more columns, a row or grid of cards, side panels, or content laid over other content. A single column read from top to bottom doesn't trigger it, even where a label sits beside its control
- Needs: annotation: reading order
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#meaningful-sequence

**How to judge.** The annotated reading order keeps the meaning: content whose meaning depends on its order, such as a label and its field, or numbered steps, reads in that order. Layer order isn't a reading-order annotation. Fails: an order that separates a label from its field, or reads steps out of sequence. Fix: annotate the reading order.

### 1.3.3 Sensory Characteristics

- Level: A
- Since: 2.0
- Group: static
- Facts: text
- Trigger: instructions: text telling the user how to understand or operate something
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#sensory-characteristics

**How to judge.** Judge the wording of each instruction.

- **Fails:** an instruction that identifies a component only by its shape, colour, size, visual location, orientation or sound, such as "Press the round button" or "Use the options on the right".
- **Passes:** the instruction also names the component by its visible label or text, such as "Select Continue, on the right".
- **Evidence:** quote the instruction, and name the characteristic it relies on.
- **Fix:** add the component's visible label to the instruction.

### 1.3.4 Orientation

- Level: AA
- Since: 2.1
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: a screen narrower than 1024 px, the width of a phone or tablet, unless the product's target platforms leave out phones and tablets
- Needs: annotation: orientation
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#orientation

**How to judge.** Passes when an annotation says the screen works in both portrait and landscape, or frames show it in both. Fails: an annotation locking one orientation, unless that orientation is essential, such as for a bank cheque or a piano. Fix: design and annotate both orientations.

### 1.3.5 Identify Input Purpose

- Level: AA
- Since: 2.1
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: form fields that collect information about the user, such as their name, email, phone, address, birth date, username, password or payment details
- Needs: annotation: input purpose
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#identify-input-purpose

**How to judge.** Each such field has an annotated input purpose from WCAG's list of input purposes, written as its autocomplete value, such as `email` or `postal-code`. Fields that aren't about the user, such as a search box or a gift recipient's address, are exempt. Fix: annotate each field's autocomplete value.

### 1.4.1 Use of Color

- Level: A
- Since: 2.0
- Group: static
- Facts: text, colourPairs, structure
- Trigger: colour that carries meaning: links in running text, states such as error, required or selected, status indicators, or charts and their legends
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#use-of-color

**How to judge.** Colour may carry meaning, as long as something else visible carries it too.

- **Fails:** colour is the only visual difference that conveys the information, with no text, icon, pattern, shape, underline, weight or position alongside it. For example: a link in running text that differs from the text around it only in colour; an error or required field shown only by a red border or label; chart series told apart only by colour; a selected tab shown only by colour.
- **Links in running text** pass with a non-colour cue, such as an underline. A link whose colour contrasts at least 3:1 with the text around it passes only when the design shows a non-colour cue on hover and focus.
- **Evidence:** what the colour conveys, and that nothing else does.
- **Fix:** add a non-colour cue, such as an underline, an icon or a text label.

### 1.4.2 Audio Control

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: audio that plays by itself, such as a video or background sound that starts on load
- Needs: annotation: autoplay
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#audio-control

**How to judge.** Passes when an annotation or prototype shows the audio stops by itself within 3 seconds, or the design has a control to pause or stop it, or a volume control separate from the system's. Fix: add a pause or stop control, or annotate that the audio doesn't play by itself.

### 1.4.3 Contrast (Minimum)

- Level: AA
- Since: 2.0
- Group: static
- Facts: colourPairs
- Trigger: visible text in the scope
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#contrast-minimum

**How to judge.** Judge every colour pair in the Design Facts.

- **Threshold.** Normal text needs a contrast ratio of at least 4.5:1. Large text needs at least 3:1.
- **Large text** is at least 24 px, or at least 18.66 px with a font weight of 700 or more (18 pt, or 14 pt bold). Figma px are read as CSS px.
- **No rounding up.** Compare the ratio as the facts give it. 4.49:1 fails 4.5:1.
- **Fails:** a ratio below the pair's threshold.
- **Exceptions:** logotypes, text in an inactive control, text that is pure decoration or that no one can see, and text that's part of a picture with significant other visual content (such as a street sign in a photo) have no requirement. When a failing layer looks like one of these by its name or its component (such as `Logo` or `Disabled`), keep the Finding, and say in its evidence which exception may apply.
- **Root Cause:** the text colour's source.
- **Evidence:** `<text colour> on <background colour> = <ratio>:1, needs <threshold>:1`, then the text size and weight, such as `#8A8A8A on #FFFFFF = 3.45:1, needs 4.5:1 (16 px, weight 400)`. Add any flag the facts give, and a token or style name when a colour came from one.
- **Fix:** raise the contrast of the text against its background to the threshold, by darkening or lightening the text colour or the background. Name a colour token only when the facts or the team's documents give one.

### 1.4.4 Resize Text

- Level: AA
- Since: 2.0
- Group: code
- Facts: none
- Trigger: text
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#resize-text

**How to judge.** Code only: a test of the running product checks that text resized to 200% loses no content or function.

### 1.4.5 Images of Text

- Level: AA
- Since: 2.0
- Group: static
- Facts: structure (what images show)
- Trigger: image layers, or vector layers such as outlined text, that may show words
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#images-of-text

**How to judge.** Judge each image or vector layer that shows words.

- **Fails:** words shown as an image or outlined vector where live text could give the same look.
- **Exceptions:** logotypes and brand names, text whose particular look is essential (such as a font specimen), and images of text the user can customise.
- **Evidence:** the layer, and the words it shows.
- **Fix:** replace the image with a text layer styled to look the same.

### 1.4.10 Reflow

- Level: AA
- Since: 2.1
- Group: static
- Facts: structure
- Trigger: a screen
- Needs: none
- Markers: 1.4.10, "Reflow"
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#reflow

**How to judge.** Judged only in a section marked for it. Judge each frame in the section that's 320 CSS px wide or narrower, for content that scrolls vertically, or 256 CSS px high or shorter, for content that scrolls horizontally. A section without such a frame can't be judged until it has one.

- **Fails:** content that's cut off, overlaps, or runs past the frame's edge so it would need scrolling in two directions, or information or a function from the wider design that's missing with no other way to reach it.
- **Exceptions:** parts that need a two-dimensional layout for their use or meaning: maps, diagrams, video, games, presentations, data tables, and toolbars that must stay in view.
- **Fix:** let the content wrap, stack or collapse at the narrow width.

### 1.4.11 Non-text Contrast

- Level: AA
- Since: 2.1
- Group: static
- Facts: colourPairs, structure
- Trigger: interactive components, state or focus indicators, or graphics needed to understand the content, such as meaningful icons and chart elements. Photos of real-life scenes, such as people or places, don't trigger it
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#non-text-contrast

**How to judge.** Judge each colour that a non-text element needs in order to be seen, against each colour next to it. Only measurements of non-text elements count: colour pairs of text layers belong to 1.4.3. Judge from the non-text colour pairs in the Design Facts.

- **Threshold:** at least 3:1 against every adjacent colour. No rounding up.
- **Applies to:** what identifies a component when nothing else does (such as a text field's border), what shows its state (a checkbox's check, a selected tab's indicator, a focus indicator), and the parts of a graphic needed to understand it (an icon with no text label, a chart's lines or segments).
- **Focus indicators:** one outside the component, such as an outside stroke or a ring around it, is judged against the colour beneath the component. One inside it is judged against the component's own fill.
- **Doesn't apply to:** a button's shape when its text identifies it, inactive components, native controls whose look the platform sets and the design hasn't changed, and graphics whose particular look is essential, such as a logo or a flag.
- **Root Cause:** the failing colour's source.
- **Evidence:** `<element colour> on <adjacent colour> = <ratio>:1, needs 3:1`, naming the element.
- **Fix:** raise the contrast of the element against the colour next to it.

### 1.4.12 Text Spacing

- Level: AA
- Since: 2.1
- Group: code
- Facts: none
- Trigger: text
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#text-spacing

**How to judge.** Code only: a test of the running product checks that text with increased line, paragraph, letter and word spacing loses no content or function.

### 1.4.13 Content on Hover or Focus

- Level: AA
- Since: 2.1
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content that appears on hover or focus, such as tooltips, popovers and sub-menus
- Needs: annotation: hover and focus behaviour
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus

**How to judge.** An annotation or prototype shows the extra content is:

- **dismissible:** it closes without moving the pointer or focus, such as with Escape, unless it reports an input error or covers nothing
- **hoverable:** the pointer can move onto it without it disappearing
- **persistent:** it stays until the pointer or focus leaves, the user dismisses it, or it's no longer valid

Fails: any of the three missing. Tooltips the browser draws itself are exempt. Fix: annotate or build the missing behaviour.

### 2.1.1 Keyboard

- Level: A
- Since: 2.0
- Group: code
- Facts: none
- Trigger: interactive components
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#keyboard

**How to judge.** Code only: a test of the running product checks that every function works from a keyboard.

### 2.1.2 No Keyboard Trap

- Level: A
- Since: 2.0
- Group: code
- Facts: none
- Trigger: interactive components
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#no-keyboard-trap

**How to judge.** Code only: a test of the running product checks that keyboard focus can always move away from every component.

### 2.1.4 Character Key Shortcuts

- Level: A
- Since: 2.1
- Group: annotation/prototype
- Facts: text, annotations
- Trigger: keyboard shortcuts of a single letter, number, punctuation or symbol key, shown or annotated in the design
- Needs: annotation: keyboard shortcuts
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#character-key-shortcuts

**How to judge.** Passes when the annotation says the user can turn the shortcut off, or remap it to include a key such as Ctrl or Alt, or that it works only while its component has focus. Fix: annotate one of these.

### 2.2.1 Timing Adjustable

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: a time limit, such as a session timeout, a countdown or a timed step
- Needs: annotation: time limit
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#timing-adjustable

**How to judge.** At least one of these is annotated or shown:

- the user can turn the limit off before meeting it
- the user can adjust it before meeting it, to at least ten times the default
- a warning comes before time runs out, giving at least 20 seconds to extend it with a simple action, and it can be extended at least ten times

Exceptions: real-time events such as an auction, limits essential to the activity, and limits over 20 hours. Fails: a limit with none of these, or a warning that gives less than 20 seconds. Fix: add and annotate a way to turn off, adjust or extend the limit.

### 2.2.2 Pause, Stop, Hide

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content that moves, blinks or scrolls by itself for more than 5 seconds beside other content, such as a carousel or ticker, or that updates by itself, such as a live feed
- Needs: annotation: autoplay
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#pause-stop-hide

**How to judge.** Passes when the design has a control to pause, stop or hide the content (or, for updating content, to set how often it updates), or an annotation says the movement stops within 5 seconds. Movement essential to the activity is exempt. Fails: a carousel that advances by itself with no pause control. Fix: add a pause control.

### 2.3.1 Three Flashes or Below Threshold

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content that may flash, such as an animation, a video or a flashing effect
- Needs: annotation: flashing
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold

**How to judge.** Passes when an annotation or the prototype shows nothing flashes more than three times in any one second, or the flashes are below WCAG's general and red flash thresholds. Fails: content that flashes more often. Fix: slow or remove the flashing, and annotate its rate.

### 2.4.1 Bypass Blocks

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content repeated across pages before the main content, such as a header or navigation
- Needs: annotation: landmarks or skip link
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#bypass-blocks

**How to judge.** Passes when the annotations include a skip link to the main content, or landmarks (such as header, navigation and main) or headings that let users jump past the repeated content. Fix: annotate a skip link or landmarks.

### 2.4.2 Page Titled

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: a screen: a whole web page or app screen
- Needs: annotation: page title
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#page-titled

**How to judge.** Each page has an annotated title that describes its topic or purpose. Fails: a title that doesn't say what the page is, such as "Untitled", or the site's name alone on an inner page. Fix: annotate a descriptive title, such as "Payment: Checkout".

### 2.4.3 Focus Order

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: more than one focusable component in the scope. The states of one component, such as its variants, count as one
- Needs: annotation: reading order
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#focus-order

**How to judge.** Judge the annotated focus order, or the reading order when no separate focus order is annotated. Focus moves in an order that keeps the meaning and operation, such as a form's fields in the order they're filled in. Fails: an order that jumps between columns or out of a sequence, or leaves an open dialog for the page behind it. Fix: annotate the focus order.

### 2.4.4 Link Purpose (In Context)

- Level: A
- Since: 2.0
- Group: static
- Facts: text, structure
- Trigger: links: text or components styled or named as links
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#link-purpose-in-context

**How to judge.** Judge each link's text together with its context: the sentence, paragraph, list item or table cell it's in, that cell's table headers, or the heading just before it.

- **Fails:** a link whose purpose can't be told from its text and that context, such as "Click here" or "Read more" with nothing around it saying what it leads to.
- **Exceptions:** a link whose purpose would be ambiguous to everyone.
- **Evidence:** quote the link text and its context.
- **Fix:** reword the link to say where it goes, such as "Read more about delivery times".

### 2.4.5 Multiple Ways

- Level: AA
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: a page within a set of pages, unless it's the result of a process or a step in one, such as a checkout step
- Needs: annotation: ways to find the page
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#multiple-ways

**How to judge.** Passes when the design shows or annotates at least two ways to reach the page, such as navigation, search, a site map, a table of contents or links from related pages. Fix: add or annotate a second way.

### 2.4.6 Headings and Labels

- Level: AA
- Since: 2.0
- Group: static
- Facts: text, structure
- Trigger: headings, or labels of fields and controls
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#headings-and-labels

**How to judge.** Judge the wording of each heading and label. The criterion doesn't require headings or labels to exist (1.3.1 and 3.3.2 cover that).

- **Fails:** a heading that doesn't describe its section's topic, or a label that doesn't describe its field or control, such as "Section 1", "Field" or "Details" above unrelated content, or two different sections with the same heading.
- **Evidence:** quote the heading or label, and say what it heads or labels.
- **Fix:** reword it to name the topic or purpose.

### 2.4.7 Focus Visible

- Level: AA
- Since: 2.0
- Group: static
- Facts: structure
- Trigger: focusable components
- Needs: none
- Markers: 2.4.7, "Focus states", a variant value `Focus` or `Focused`
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#focus-visible

**How to judge.** Judged only in a section marked for it, or on a component whose variants mark it. Compare each focused state with the same component's default state, by their fills, strokes and effects.

- **Fails:** a focused state that looks the same as the default, or a focusable component in the marked section with no focused state.
- **Contrast** of the focus indicator is judged under 1.4.11, not here.
- **Evidence:** the component, and what differs between its default and focused states.
- **Fix:** add a visible focus indicator, such as an outline.

### 2.4.11 Focus Not Obscured (Minimum)

- Level: AA
- Since: 2.2
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: content that stays over the page, such as a sticky header or footer, a cookie banner or a non-modal dialog, on a screen with focusable components
- Needs: state: focus under sticky content
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum

**How to judge.** Judge frames or a prototype that show focused components scrolled beside the sticky content. Fails: a focused component entirely hidden by content the design adds. Partly hidden passes. Content the user opened and can dismiss without moving focus doesn't count. Fix: keep focused components clear of the sticky content, such as with scroll padding.

### 2.5.1 Pointer Gestures

- Level: A
- Since: 2.1
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: functions operated by a multipoint gesture, such as a pinch, or a path-based gesture, such as a swipe
- Needs: annotation: gesture alternative
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#pointer-gestures

**How to judge.** Each such function also works with a single tap or click and no path, such as through buttons, unless the gesture is essential, such as a signature. A visible alternative control counts. Fix: add a single-pointer alternative.

### 2.5.2 Pointer Cancellation

- Level: A
- Since: 2.1
- Group: code
- Facts: none
- Trigger: functions operated by a pointer
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#pointer-cancellation

**How to judge.** Code only: a test of the running product checks that single-pointer actions complete on release, or can be aborted or undone.

### 2.5.3 Label in Name

- Level: A
- Since: 2.1
- Group: annotation/prototype
- Facts: text, annotations
- Trigger: an interactive component with a visible text label and an annotated accessible name. A name that isn't annotated comes from the visible label in code, so it doesn't trigger this criterion
- Needs: annotation: accessible name
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#label-in-name

**How to judge.** The annotated name contains the visible label's words in the same order, best at its start. Fails: a "Send" button annotated as "Submit form". Fix: start the name with the visible label.

### 2.5.4 Motion Actuation

- Level: A
- Since: 2.1
- Group: annotation/prototype
- Facts: text, annotations
- Trigger: functions operated by moving the device, such as shaking or tilting it, or by the user's motion
- Needs: annotation: motion alternative
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#motion-actuation

**How to judge.** Passes when the same function also works through a control on the screen, and the user can turn the motion response off. Motion used through an accessibility-supported interface, or essential to the function, such as a step counter, is exempt. Fix: add a control and a setting, and annotate them.

### 2.5.7 Dragging Movements

- Level: AA
- Since: 2.2
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: functions operated by dragging, such as sliders, sortable lists, drag and drop, or panning a map
- Needs: annotation: dragging alternative
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#dragging-movements

**How to judge.** Each such function also works with a single pointer without dragging, such as tapping a point on a slider's track, arrow buttons, or a "Move to" menu. A visible alternative control counts. Dragging that's essential, such as freehand drawing, is exempt. Fix: add a non-dragging alternative.

### 2.5.8 Target Size (Minimum)

- Level: AA
- Since: 2.2
- Group: static
- Facts: structure (target sizes)
- Trigger: pointer targets: buttons, links, form controls and anything else that acts on a tap or click
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#target-size-minimum

**How to judge.** Measure each target's bounding box.

- **Threshold:** at least 24 by 24 CSS px. In a web frame at 1x, Figma px are CSS px. A native frame converts by its stated density, and with no density stated the measurement is `needs-review`.
- **Exceptions:**
  - **Spacing:** an undersized target passes when a 24 px circle centred on its bounding box doesn't overlap another target, or another undersized target's circle.
  - **Equivalent:** another control on the same screen that meets the size does the same thing.
  - **Inline:** the target is in a sentence, or its size is set by the line height of the text around it.
  - **User agent control:** a native control the design hasn't restyled.
  - **Essential:** the size is essential or legally required.
- **Evidence:** `<width>×<height> px, needs 24×24 px`, and the spacing to the nearest target when the spacing exception was checked.
- **Fix:** enlarge the target, or space it so the spacing exception applies.

### 3.1.1 Language of Page

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: annotations
- Trigger: a screen: a whole web page or app screen
- Needs: annotation: language
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#language-of-page

**How to judge.** Each page has an annotated default language, such as `en` or `fr-CA`, matching its content. Fix: annotate the page's language.

### 3.1.2 Language of Parts

- Level: AA
- Since: 2.0
- Group: annotation/prototype
- Facts: text, annotations
- Trigger: a passage or phrase in a language other than the page's, except proper names, technical terms, and words that have become part of the page's language
- Needs: annotation: language
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#language-of-parts

**How to judge.** Each such passage or phrase has an annotated language. Fix: annotate the passage's language.

### 3.2.1 On Focus

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: focusable components
- Needs: state: behaviour on focus
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#on-focus

**How to judge.** Judge prototype interactions or annotations that say what happens on focus. A focused variant shows only how focus looks, not what it does. Focusing a component doesn't change the context: it doesn't submit a form, open a page or window, move focus elsewhere, or change content in a way that alters the page's meaning. Fix: make the change happen on an explicit action, such as a button.

### 3.2.2 On Input

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: form fields and other controls that take input
- Needs: state: behaviour on input
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#on-input

**How to judge.** Judge prototype interactions or annotations that say what happens when a setting changes. Changing a control's value doesn't change the context, such as a select that submits a form or opens a page, unless the user was told beforehand. Fix: add a submit button, or tell the user beforehand.

### 3.2.3 Consistent Navigation

- Level: AA
- Since: 2.0
- Group: static
- Facts: structure, components, text
- Trigger: navigation, such as a navigation bar, menu, tab bar or footer
- Needs: none
- Markers: 3.2.3, "User flow"
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#consistent-navigation

**How to judge.** Judged only in a section marked for it. Compare the navigation repeated across the section's screens.

- **Fails:** repeated items that appear in a different relative order on different screens. Adding or removing items is fine while the repeated ones keep their order.
- **Exceptions:** a change the user makes, such as reordering a menu.
- **Evidence:** the screens compared, and the items that move.
- **Fix:** keep the repeated items in one order, ideally with one component.

### 3.2.4 Consistent Identification

- Level: AA
- Since: 2.0
- Group: static
- Facts: structure, components, text
- Trigger: interactive components, such as buttons, links and icons that do something
- Needs: none
- Markers: 3.2.4, "User flow"
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#consistent-identification

**How to judge.** Judged only in a section marked for it. Compare components that do the same thing across the section's screens.

- **Fails:** the same function labelled or shown differently, such as a search button labelled "Search" on one screen and "Find" on another, or with different icons.
- **Evidence:** the screens compared, and each label or icon.
- **Fix:** use one label and icon for the function, ideally with one component.

### 3.2.6 Consistent Help

- Level: A
- Since: 2.2
- Group: static
- Facts: structure, text
- Trigger: help: contact details, a contact form or chat, or a self-help link such as FAQs
- Needs: none
- Markers: 3.2.6, "User flow"
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#consistent-help

**How to judge.** Judged only in a section marked for it. Compare where the help repeated across the section's screens sits.

- **Fails:** help that appears in a different order relative to the other content on different screens, such as in the header on one and the footer on another.
- **Exceptions:** a change the user makes.
- **Evidence:** the screens compared, and where the help is on each.
- **Fix:** keep help in the same place relative to the other content.

### 3.3.1 Error Identification

- Level: A
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: form fields whose input is checked, such as required fields or fields with a format
- Needs: state: error
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#error-identification

**How to judge.** Judge each error state. It identifies the field in error and describes the error in text. Fails: an error shown only by colour or an icon, or a message that doesn't say which field or what's wrong, such as "Invalid input". Fix: add a text message next to the field that names the problem.

### 3.3.2 Labels or Instructions

- Level: A
- Since: 2.0
- Group: static
- Facts: text, structure
- Trigger: form fields and other controls that take input
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#labels-or-instructions

**How to judge.** Judge each field and each group of related controls.

- **Fails:** a field with no visible label or instruction; a group of controls, such as radio buttons or a date split into three fields, with no group label; a required format, such as a date format, that isn't stated.
- **Placeholder-only labels:** a field whose only label is placeholder text inside it is a Finding too, since the text disappears once the user types. This is issue #5's reading: W3C's Understanding document doesn't list it as a failure, so the evidence says so.
- **Evidence:** the field, and what labels it now.
- **Fix:** add a visible label above or beside the field, and any instruction it needs.

### 3.3.3 Error Suggestion

- Level: AA
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: form fields whose input is checked, such as required fields or fields with a format
- Needs: state: error
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#error-suggestion

**How to judge.** Judge each error state. When a way to fix the error is known, the message suggests it, such as "Enter a date as DD/MM/YYYY", unless that would weaken security, such as saying which part of a login was wrong. Fails: a message that only says the input is wrong. Fix: add the suggestion to the message.

### 3.3.4 Error Prevention (Legal, Financial, Data)

- Level: AA
- Since: 2.0
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: a screen that makes a legal commitment or a financial transaction, changes or deletes the user's stored data, or submits test answers
- Needs: state: review, confirmation or undo
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#error-prevention-legal-financial-data

**How to judge.** Judge the flow around the submission. At least one holds: the submission can be undone; the input is checked and the user can correct it; or the user can review, confirm and correct everything before it's final. Fix: add a review step, a confirmation or an undo.

### 3.3.7 Redundant Entry

- Level: A
- Since: 2.2
- Group: annotation/prototype
- Facts: structure, annotations
- Trigger: a process with more than one step that takes the user's input
- Needs: state: the later steps of the process
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#redundant-entry

**How to judge.** Judge the later steps. Information the user already entered or was given in the same process is filled in for them, or offered to select, such as a "Same as delivery address" option. Exceptions: re-entry that's essential, needed for security (such as confirming a new password), or when the earlier information is no longer valid. Fix: prefill the field, or offer the earlier value.

### 3.3.8 Accessible Authentication (Minimum)

- Level: AA
- Since: 2.2
- Group: annotation/prototype
- Facts: text, structure, annotations
- Trigger: a sign-in or other authentication step
- Needs: annotation: authentication support
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum

**How to judge.** A step that asks the user to remember, transcribe or solve something, such as a password, a code to copy or a puzzle, passes when the annotation says paste and password managers work in its fields, or another way to authenticate without such a test is offered, such as a passkey or an emailed link. Recognising objects, or content the user provided, passes. Fails: a puzzle or transcription with no alternative, or a field that blocks paste. Fix: allow paste and password managers, or offer another method.

### 4.1.2 Name, Role, Value

- Level: A
- Since: 2.0
- Group: code
- Facts: none
- Trigger: interactive components
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG22/#name-role-value

**How to judge.** Code only: a test of the running product checks that each component's name, role, states and value reach assistive technology.

### 4.1.3 Status Messages

- Level: AA
- Since: 2.1
- Group: code
- Facts: none
- Trigger: status messages, such as a result count, a saved confirmation or a progress update
- Needs: none
- Markers: none
- Default Severity: moderate
- W3C: https://www.w3.org/TR/WCAG22/#status-messages

**How to judge.** Code only: a test of the running product checks that status messages reach assistive technology without taking focus.

## WCAG 2.1 changes

At a WCAG 2.1 target, the entries apply by their Since and Removed lines. That makes these differences from WCAG 2.2:

- **Not in WCAG 2.1:** 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7 and 3.3.8, which have Since 2.2.
- **Only in WCAG 2.1:** 4.1.1 Parsing, below. WCAG 2.2 removed it.
- **Links:** a Finding's `standard.url` is `https://www.w3.org/TR/WCAG21/` with the anchor from the entry's W3C line. 2.5.5's anchor there is `#target-size`.
- **Names:** 2.5.5 is called Target Size in WCAG 2.1.

### 4.1.1 Parsing

- Level: A
- Since: 2.0
- Removed: 2.2
- Group: code
- Facts: none
- Trigger: the product's markup
- Needs: none
- Markers: none
- Default Severity: serious
- W3C: https://www.w3.org/TR/WCAG21/#parsing

**How to judge.** Code only. WCAG 2.1 notes that content using HTML or XML always satisfies it.

## AAA criteria judged from a design

These are judged only as above-target checks, since this reference covers no AAA target. When a failure also fails the matching A or AA criterion that's judged in the same run (1.4.3 for 1.4.6, 2.4.4 for 2.4.9, 2.5.8 for 2.5.5), only that criterion's Finding is raised.

### 1.4.6 Contrast (Enhanced)

- Level: AAA
- Since: 2.0
- Group: static
- Facts: colourPairs
- Trigger: visible text in the scope
- Needs: none
- Markers: none
- Default Severity: advisory
- W3C: https://www.w3.org/TR/WCAG22/#contrast-enhanced

**How to judge.** As 1.4.3, with its large-text rule, exceptions, Root Cause, evidence and fix, but with higher thresholds: normal text needs at least 7:1, and large text at least 4.5:1.

### 2.4.9 Link Purpose (Link Only)

- Level: AAA
- Since: 2.0
- Group: static
- Facts: text, structure
- Trigger: links: text or components styled or named as links
- Needs: none
- Markers: none
- Default Severity: advisory
- W3C: https://www.w3.org/TR/WCAG22/#link-purpose-link-only

**How to judge.** Each link's text says on its own where it goes or what it does, without its context. Fails: "Read more", even when the sentence around it explains. A link whose purpose would be ambiguous to everyone is exempt. Fix: reword the link to say where it goes.

### 2.4.10 Section Headings

- Level: AAA
- Since: 2.0
- Group: static
- Facts: text, structure
- Trigger: written content in sections, such as an article, a help page or a long form. It covers writing, not interface components
- Needs: none
- Markers: none
- Default Severity: advisory
- W3C: https://www.w3.org/TR/WCAG22/#section-headings

**How to judge.** Each section of the content starts with a heading. Fails: a run of sections with no heading between them. Fix: add a heading to each section.

### 2.5.5 Target Size (Enhanced)

- Level: AAA
- Since: 2.1
- Group: static
- Facts: structure (target sizes)
- Trigger: pointer targets: buttons, links, form controls and anything else that acts on a tap or click
- Needs: none
- Markers: none
- Default Severity: advisory
- W3C: https://www.w3.org/TR/WCAG22/#target-size-enhanced

**How to judge.** Measure each target as for 2.5.8. It needs at least 44 by 44 CSS px. The exceptions are equivalent (another control on the screen, at least 44 px, does the same thing), inline (in a sentence or block of text), user agent control, and essential. There's no spacing exception. Evidence: `<width>×<height> px, needs 44×44 px`.
