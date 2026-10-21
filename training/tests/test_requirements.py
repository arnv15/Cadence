"""Keeps requirements-ci.txt honest about requirements.txt.

The CI file exists only to skip building whisper.cpp, which the tests never call. If a dependency
is added or a version bumped in one file and not the other, CI stops testing what developers run.
"""

from pathlib import Path
from typing import Dict

ROOT = Path(__file__).resolve().parents[1]

#: Packages deliberately absent from the CI set, with the reason recorded in requirements-ci.txt.
CI_OMITS = {'pywhispercpp'}


def _pins(path: Path) -> Dict[str, str]:
    pins: Dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, _, version = line.partition('==')
        pins[name.strip().lower()] = version.strip()
    return pins


def test_ci_requirements_match_except_the_documented_omission():
    full = _pins(ROOT / 'requirements.txt')
    ci = _pins(ROOT / 'requirements-ci.txt')

    assert CI_OMITS <= set(full), 'requirements.txt no longer pins what CI claims to omit'
    assert set(ci) == set(full) - CI_OMITS, (
        'requirements-ci.txt is out of step with requirements.txt: '
        f'only in CI {sorted(set(ci) - set(full))}, missing from CI {sorted(set(full) - CI_OMITS - set(ci))}'
    )
    for name, version in ci.items():
        assert version == full[name], f'{name} pinned {version} in CI but {full[name]} in requirements.txt'
