# NEXA Mascot Sprite Layers

Generated from the existing NEXA female mascot illustration for use in React/TypeScript.

All five PNG images are **1024 × 1024**, **RGBA transparent**, and **pixel-aligned**.

- `body.png` — static body, hair/arm removed, shoulder/neck joints underpainted for movement.
- `head.png` — head, long ponytail, face with whites for eyeballs, **no pupils**.
- `pupils.png` — only two pupil/iris graphics, aligned to the eye whites.
- `blink.png` — eyelid skin and closed-eye curves, display during blinks.
- `arm.png` — hand/arm and paddle, isolated for rotation.

Suggested z-order back to front: `body`, `arm`, `head`, `pupils`, `blink`.
Set all images to the same exact `width:100%; height:100%; position:absolute; inset:0` and never crop them individually.

Animation pivots for 1024x1024 stage:
- Head: `transform-origin: 49% 21%` (adjust to your desired response).
- Arm: `transform-origin: 42% 24%` (rough shoulder connection).
- Eyes: only translate 1-3 pixels; blink layer should move with head, not pupils.
- Keep arm rotation conservative (2-3 degrees) because the original is a flattened illustration and fully hidden anatomy cannot be reconstructed exactly.

`preview-animation.html`: open in a browser to preview blinking, head tracking and arm swing. No server dependencies.
`preview-composed.png`: static composite for visual inspection.

**Important:** These are manually separated and retouched pixel layers from a single flattened AI illustration, not original artist layers. The reconstructed joints and eye geometry are approximate; fine-tune after testing, particularly if increasing animation amplitude. The original generated artwork contained fringe noise which was removed where possible.
