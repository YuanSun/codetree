// Read words aloud with the browser's built-in voices, preferring Canadian French.
let voice: SpeechSynthesisVoice | null = null;

function pick() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  const fr = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("fr"));
  voice =
    fr.find((v) => /fr-ca/i.test(v.lang.replace("_", "-"))) ??
    fr.find((v) => /fr-fr/i.test(v.lang.replace("_", "-"))) ??
    fr[0] ??
    null;
}

if ("speechSynthesis" in window) {
  pick();
  speechSynthesis.addEventListener?.("voiceschanged", pick);
}

export const canSpeak = () => "speechSynthesis" in window;

export function speak(text: string, rate = 0.85) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? "fr-CA";
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
