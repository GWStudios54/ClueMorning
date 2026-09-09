# Deep Cut Rive production brief

This is the production brief for the first Clue Morning animated-page asset.

## Goal

Create a warm, editorial morning-desk atmosphere for **Deep Cut** that feels premium and alive without competing with the puzzle UI. The playable UI remains HTML above the Rive canvas. The Rive scene should add environmental motion and state reactions around the edges.

## Artboard

- Name: `DeepCutScene`
- Suggested design size: 1600 × 900, responsive-safe composition
- Transparent background preferred
- Keep the center ~60% of the composition quiet and low contrast so the HTML prompt/input remains easy to read
- Put the strongest visual detail near the left/right edges and corners
- Match Clue Morning's warm paper/editorial identity rather than glossy app-game art

## Visual language

Use a cozy morning desk / clue-board scene:

- cream paper, warm off-white desk surface
- clipped or taped clue notes at edges
- pencil or pen
- coffee cup with very subtle steam
- soft angled morning light
- faint paper texture / coffee-ring detail
- tiny pin, underline, or annotation details
- no mascots required for this first asset
- no dense text inside the Rive asset

Motion should be restrained in idle state. The puzzle should feel calm until the player acts.

## State machine

State machine name: `DeepCut`

Create these trigger inputs exactly:

- `Start`
- `Prompt`
- `Correct`
- `CorrectCommon`
- `CorrectUncommon`
- `CorrectRare`
- `Wrong`
- `Urgent`
- `Complete`

The website first attempts the tier-specific Correct trigger and falls back to `Correct`, so `Correct` should remain usable even if tier-specific treatments are subtle.

## State behavior

### Idle

Default looping state before play begins.

- very slow steam drift
- almost imperceptible paper movement
- tiny morning-light drift
- nothing pulsing or calling for attention

### Start

Triggered when the player presses Start Deep Cut.

- desk wakes up slightly
- light strengthens
- paper elements settle into a more focused composition
- approximately 400–700 ms reaction, then return to live ambience

### Prompt

Triggered when a new prompt appears.

- one edge note shifts, flips, slides, or settles
- small pencil/note reaction
- keep the center clear because HTML handles the actual prompt entrance
- approximately 250–450 ms

### Correct / CorrectCommon

- small warm confirmation
- subtle highlight or paper tick
- restrained enough that common answers still feel like the lowest reward tier

### CorrectUncommon

- stronger green/warm accent
- two or three environmental elements react
- noticeably more satisfying than Common

### CorrectRare

- strongest positive reaction
- golden morning-light flash or edge burst
- papers/pencil can react more dramatically
- still no full-screen visual noise; HTML layer already adds a rarity burst

### Wrong

- very short desk/paper twitch or pencil bump
- no aggressive red-screen effect
- approximately 250–350 ms

### Urgent

Triggered once per prompt when the timer reaches five seconds.

- add subtle tension: quicker steam/light movement, tiny desk vibration, or sharpened edge highlight
- loop can persist briefly, but it must not become visually exhausting
- the HTML timer already pulses red

### Complete

- morning light opens up
- papers settle neatly
- coffee/desk composition becomes calm and complete
- approximately 700–1200 ms then rest in a pleasant completed idle

## Runtime contract

The dependency-free HTML/CSS animation preview lives in `public/animation-overhaul.js` and is loaded only when the page URL explicitly includes `?motion-preview=deepcut`.

The preview does **not** fetch Rive, Motion, or any other third-party runtime. When the final `.riv` asset exists, the Rive runtime must be self-hosted by Clue Morning and initialized separately. After creating the Rive instance, attach it to the existing bridge:

```js
window.ClueMotion.registerRive('deepcut', {
  instance: deepCutRiveInstance,
  stateMachine: 'DeepCut'
});
```

The instance must expose `stateMachineInputs('DeepCut')`. Until a self-hosted Rive instance is attached, all Rive calls are inert and the dependency-free WAAPI/CSS presentation remains the complete fallback.

## Preview safety contract

- Normal Clue Morning pages do not load the animation JS or CSS.
- The Worker injects preview assets only for `?motion-preview=deepcut`.
- Preview HTML is returned with `Cache-Control: no-store`.
- The client checks the preview parameter again before installing anything.
- The PWA app shell does not preload animation assets.
- If Web Animations is unavailable or preview boot throws, the puzzle remains normal HTML and continues working.

## Performance constraints

- Prefer vector shapes and simple meshes
- Avoid large raster textures unless visually necessary
- Keep idle animation inexpensive
- Do not animate the entire canvas every frame with heavy blur/noise effects
- Keep the center visually quiet
- Respect that mobile is a primary surface
- Test at narrow phone widths as well as desktop
- Self-host the eventual Rive runtime; do not introduce a runtime CDN dependency
- Keep nonessential mobile ambient elements removable without changing game state

## Rive Agent seed prompt

Use this as the starting prompt in Rive's AI tooling:

> Create a responsive 1600×900 Rive scene for a daily word-and-trivia website called Clue Morning. The scene is for a game named Deep Cut. Use a cozy editorial morning-desk aesthetic: cream paper, warm off-white desk, clipped or taped clue notes at the outer edges, a pencil, a coffee cup with subtle steam, faint coffee-ring details, and soft angled morning light. Keep the center 60% visually quiet and low contrast because live HTML puzzle controls will sit over it. Build a state machine named DeepCut with trigger inputs Start, Prompt, Correct, CorrectCommon, CorrectUncommon, CorrectRare, Wrong, Urgent, and Complete. Idle should be extremely subtle. Start should wake the desk. Prompt should shift one note. Common, Uncommon, and Rare should have progressively stronger positive reactions, with Rare using a restrained golden light reaction. Wrong should be a short paper or pencil twitch. Urgent should create subtle five-second tension. Complete should brighten and settle the desk into a calm finished state. No dense text, no full-screen flashing, and no motion in the center that makes the puzzle hard to read.
