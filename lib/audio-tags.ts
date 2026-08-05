/**
 * Delivery direction for ElevenLabs v3.
 *
 * v3 reads bracketed cues as performance direction rather than words to speak,
 * so the narration itself is where a lesson's warmth comes from — a flat read
 * of good writing still sounds like a machine. Shared verbatim by both
 * engines' prompts so the two sound like the same teacher.
 *
 * Requires `ELEVENLABS_MODEL_ID=eleven_v3`; older models speak the brackets or
 * ignore them, which is why the guidance stays inside this one constant.
 */
export const AUDIO_TAG_GUIDE = `The voice engine performs inline tags in square brackets instead of speaking them. Use them — a lesson read flat sounds like a machine reading good writing.

Tags that fit teaching:
- Curiosity and setup: [curious], [thoughtful], [intrigued] — for the question that opens a thread.
- Emphasis and payoff: [excited], [emphatic] — for the line the whole scene was building to. One per scene at most.
- Warmth and reassurance: [warmly], [reassuring], [gently] — when something sounds harder than it is.
- Confiding: [whispers] — for the aside, the caveat, the thing "between us". Rare and effective.
- Dry humour: [amused], [sarcastic] — for an absurd number or a bad idea. Sparingly.
- Weight: [serious], [sighs] — for a genuine failure mode or a real cost.
- Pacing: [pause] — a beat before something lands.

How to use them well:
- Two to four per scene. Zero is flat; one on every sentence is a performance, not an explanation.
- Put the tag immediately before the words it colours, not at the top of the scene: "So most of the time, [pause] it is simply waiting."
- Tags can be combined for a blend: "[thoughtful, slowly] That is the part people miss."
- Match the tag to what you are actually saying. [excited] on a definition sounds unhinged; [excited] on a result that genuinely surprised people sounds human.
- Punctuation is direction too: an ellipsis makes a real pause, CAPITALS add stress, and short sentences land harder than long ones.`
