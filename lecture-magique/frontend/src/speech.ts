// Read words aloud with the browser's built-in voices: Canadian French for French, then
// Canadian / American / British English for English.
const voices: Record<string, SpeechSynthesisVoice | null> = { fr: null, en: null };
const PREFER: Record<string, RegExp[]> = {
  fr: [/^fr-ca/i, /^fr-fr/i, /^fr/i],
  en: [/^en-ca/i, /^en-us/i, /^en-gb/i, /^en/i],
};

function pick() {
  if (!("speechSynthesis" in window)) return;
  const all = speechSynthesis.getVoices();
  for (const lang of Object.keys(PREFER)) {
    voices[lang] = null;
    for (const re of PREFER[lang]) {
      const v = all.find((x) => re.test(x.lang.replace("_", "-")));
      if (v) { voices[lang] = v; break; }
    }
  }
}

if ("speechSynthesis" in window) {
  pick();
  speechSynthesis.addEventListener?.("voiceschanged", pick);
}

export const canSpeak = () => "speechSynthesis" in window;

export function speak(text: string, rate = 0.85, lang: string = "fr") {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = voices[lang] ?? null;
  u.lang = voice?.lang ?? (lang === "en" ? "en-US" : "fr-CA");
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
