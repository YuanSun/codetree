from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Lens:
    key: str
    label: str
    template: str
    needs_character: bool = False


LENSES: list[Lens] = [
    Lens("five_w1h", "5W1H pass (who/what/when/where/why/how)", "lenses/five_w1h.md.j2"),
    Lens(
        "character_focus",
        "Character deep-dive (motivation, inner voice)",
        "lenses/character_focus.md.j2",
        needs_character=True,
    ),
    Lens("transitions", "Transitions (link to previous/next chapter)", "lenses/transitions.md.j2"),
    Lens("contrast", "Contrast & tension devices", "lenses/contrast.md.j2"),
    Lens("foreshadowing", "Foreshadowing & hints", "lenses/foreshadowing.md.j2"),
    Lens("pacing", "Pacing check", "lenses/pacing.md.j2"),
    Lens("dialogue", "Dialogue pass", "lenses/dialogue.md.j2"),
    Lens("setting_sensory", "Setting & sensory detail", "lenses/setting_sensory.md.j2"),
    Lens(
        "continuity_check",
        "Continuity check vs. story bible & earlier chapters",
        "lenses/continuity_check.md.j2",
    ),
]

LENS_BY_KEY = {lens.key: lens for lens in LENSES}
