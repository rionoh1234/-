#!/usr/bin/env python3
"""조선 고봉밥 모드 정적 검증 스크립트.

게임을 실행하지 않고 확인할 수 있는 오류를 찾습니다.
  - 중괄호 짝, 따옴표 짝
  - 정의되지 않은 이벤트/저널/수정자/스크립트 효과·트리거 참조
  - 바닐라에 없는 수정자 타입 (참조 목록이 있을 때)
  - 알 수 없는 스크립트 키워드 (참조 목록이 있을 때)
  - 누락된 현지화 키, UTF-8 BOM 여부

사용법:
  python3 tools/validate_mod.py joseon_flavor \
      [--modifier-types modifier_types.txt] [--keywords effect_trigger_valid_keys.txt]

참조 목록은 Vic3TimelineExtended 저장소의 docs/engine/effect_trigger_valid_keys.txt 와
vanilla_parsed/common/modifier_types.json(키 목록)에서 만들 수 있습니다 (README 참고).
"""
import argparse
import os
import re
import sys

TOKEN_RE = re.compile(r'"[^"\n]*"|[{}=<>!?]+|[^\s{}=<>!?"]+')

# 블록 구조 키워드 (엔진 효과/트리거가 아닌 정의용 필드)
STRUCTURAL = {
    # 이벤트
    "namespace", "type", "placement", "title", "desc", "flavor", "event_image", "video", "texture",
    "on_created_soundeffect", "icon", "duration", "cooldown", "trigger", "immediate", "option",
    "name", "default_option", "ai_chance", "base", "show_as_unavailable", "after",
    # 저널
    "group", "modifiers_while_active", "current_value", "goal_add_value", "progressbar",
    "complete", "on_complete", "fail", "on_fail", "timeout", "on_timeout", "invalid",
    "on_invalid", "on_monthly_pulse", "on_weekly_pulse", "on_yearly_pulse", "can_revolution_inherit",
    "should_be_pinned_by_default_uninvolved_or_context", "weight", "effect", "random_events",
    "is_shown_when_inactive", "possible",
    # 결정
    "is_shown", "when_taken",
    # 온액션
    "on_actions", "events",
    # 정적 수정자
    "icon",
    # 공통 파라미터
    "limit", "value", "add", "subtract", "multiply", "divide", "min", "max", "days", "months",
    "years", "id", "popup", "country", "strata", "pop_type", "text", "is_decaying",
    "first_name", "last_name", "birth_date", "ig_leader", "interest_group", "ideology", "traits",
    "save_scope_as", "on_created", "technology", "progress", "IG", "yes", "no", "always",
    "NOT", "OR", "AND", "NOR", "NAND", "if", "else_if", "else",
    # 값 링크 (트리거 목록이 아닌 event_targets에 있으며 비교에 사용)
    "gdp",
}

LOC_LINE_RE = re.compile(r'^\s+([A-Za-z0-9_.\-]+):\d*\s+"(.*)"\s*$')


def tokenize(text):
    out = []
    for lineno, line in enumerate(text.splitlines(), 1):
        code = line.split("#", 1)[0]
        for m in TOKEN_RE.finditer(code):
            out.append((m.group(0), lineno))
    return out


def parse(tokens, path, errors):
    """토큰을 (key, op, value) 트리로 변환. value는 문자열 또는 리스트."""
    pos = 0

    def parse_block(depth):
        nonlocal pos
        items = []
        while pos < len(tokens):
            tok, ln = tokens[pos]
            if tok == "}":
                if depth == 0:
                    errors.append(f"{path}:{ln}: 짝이 없는 '}}'")
                    pos += 1
                    continue
                pos += 1
                return items
            if tok == "{":
                pos += 1
                items.append((None, None, parse_block(depth + 1), ln))
                continue
            key = tok
            pos += 1
            if pos < len(tokens) and tokens[pos][0] in ("=", "?=", "<", ">", "<=", ">=", "!="):
                op = tokens[pos][0]
                pos += 1
                if pos >= len(tokens):
                    errors.append(f"{path}:{ln}: '{key} {op}' 뒤에 값이 없음")
                    return items
                vtok, vln = tokens[pos]
                if vtok == "{":
                    pos += 1
                    items.append((key, op, parse_block(depth + 1), ln))
                else:
                    pos += 1
                    items.append((key, op, vtok, ln))
            else:
                items.append((key, None, None, ln))
        if depth > 0:
            errors.append(f"{path}: 파일 끝까지 닫히지 않은 '{{'")
        return items

    return parse_block(0)


def walk(items, fn, parents=()):
    for key, op, val, ln in items:
        fn(key, op, val, ln, parents)
        if isinstance(val, list):
            walk(val, fn, parents + (key,))


def load_list(path):
    if not path:
        return None
    with open(path, encoding="utf-8") as f:
        return {l.strip() for l in f if l.strip() and not l.startswith("#")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mod_dir")
    ap.add_argument("--modifier-types")
    ap.add_argument("--keywords")
    args = ap.parse_args()

    modifier_types = load_list(args.modifier_types)
    keywords = load_list(args.keywords)
    errors, warnings = [], []

    files = {}
    for root, _, names in os.walk(args.mod_dir):
        for n in names:
            p = os.path.join(root, n)
            if n.endswith(".txt"):
                raw = open(p, "rb").read()
                text = raw.decode("utf-8-sig")
                if text.count('"') % 2:
                    errors.append(f"{p}: 따옴표 개수가 홀수")
                files[p] = parse(tokenize(text), p, errors)

    def in_dir(sub):
        return {p: t for p, t in files.items() if os.sep + sub + os.sep in p or p.startswith(os.path.join(args.mod_dir, sub))}

    # 정의 수집
    events, jes, decisions, modifiers, s_effects, s_triggers, on_actions = set(), set(), set(), set(), set(), set(), set()
    event_opts = {}
    for p, tree in in_dir("events").items():
        for key, op, val, ln in tree:
            if key and isinstance(val, list) and "." in key:
                events.add(key)
                names = []
                for k2, _, v2, _ in val:
                    if k2 == "option" and isinstance(v2, list):
                        for k3, _, v3, _ in v2:
                            if k3 == "name":
                                names.append(v3)
                event_opts[key] = names
    for p, tree in in_dir("common/journal_entries").items():
        jes |= {k for k, _, v, _ in tree if isinstance(v, list)}
    for p, tree in in_dir("common/decisions").items():
        decisions |= {k for k, _, v, _ in tree if isinstance(v, list)}
    for p, tree in in_dir("common/static_modifiers").items():
        for k, _, v, ln in tree:
            if isinstance(v, list):
                modifiers.add(k)
                for mk, _, mv, mln in v:
                    if mk != "icon" and modifier_types is not None and mk not in modifier_types:
                        errors.append(f"{p}:{mln}: 바닐라에 없는 수정자 타입 '{mk}' ({k})")
    for p, tree in in_dir("common/scripted_effects").items():
        s_effects |= {k for k, _, v, _ in tree if isinstance(v, list)}
    for p, tree in in_dir("common/scripted_triggers").items():
        s_triggers |= {k for k, _, v, _ in tree if isinstance(v, list)}
    for p, tree in in_dir("common/on_actions").items():
        on_actions |= {k for k, _, v, _ in tree if isinstance(v, list)}

    own = events | jes | decisions | modifiers | s_effects | s_triggers | on_actions
    loc_needed = set()

    def check(key, op, val, ln, parents, path):
        if key is None:
            return
        parent = parents[-1] if parents else None
        # 참조 확인
        if key == "id" and parent in ("trigger_event",) and val not in events:
            errors.append(f"{path}:{ln}: 정의되지 않은 이벤트 '{val}'")
        if parent == "random_events" and key.replace(".", "").isdigit() is False and key.isdigit():
            if val != "0" and val not in events:
                errors.append(f"{path}:{ln}: 정의되지 않은 이벤트 '{val}'")
        if key == "type" and parent == "add_journal_entry" and val not in jes:
            errors.append(f"{path}:{ln}: 정의되지 않은 저널 '{val}'")
        if key in ("has_journal_entry",) and val not in jes:
            errors.append(f"{path}:{ln}: 정의되지 않은 저널 '{val}'")
        if key == "name" and parent in ("add_modifier",) and val not in modifiers:
            warnings.append(f"{path}:{ln}: 이 모드에 없는 수정자 '{val}' (바닐라 수정자인지 확인)")
        if key in ("has_modifier", "remove_modifier") and isinstance(val, str) and val not in modifiers:
            warnings.append(f"{path}:{ln}: 이 모드에 없는 수정자 '{val}'")
        if parent == "modifiers_while_active" and key not in modifiers:
            errors.append(f"{path}:{ln}: 정의되지 않은 수정자 '{key}'")
        if key.startswith("jfp_") and op == "=" and parents and key not in own and parent not in (
                "modifiers_while_active",) and key not in ("jfp_initialized",):
            if val in ("yes", "no") or isinstance(val, list):
                errors.append(f"{path}:{ln}: 정의되지 않은 스크립트 효과/트리거 '{key}'")
        # 현지화 필요 키
        if key in ("text",) and parent == "custom_tooltip":
            loc_needed.add(val)
        if key == "custom_tooltip" and isinstance(val, str):
            loc_needed.add(val)
        if key in ("first_name", "last_name") and parent == "create_character":
            loc_needed.add(val)
        if key == "name" and parent == "create_power_bloc":
            loc_needed.add(val)
        # 바닐라 키워드 확인
        if keywords is not None and parents:
            if (key not in keywords and key not in STRUCTURAL and key not in own
                    and not key.startswith(("c:", "s:", "ig:", "var:", "scope:", "cu:", "law_type:"))
                    and not key.replace(".", "").isdigit()
                    and parent not in ("traits", "random_list", "modifiers_while_active", "random_events")
                    and not (parent and parent in modifiers)):
                warnings.append(f"{path}:{ln}: 바닐라 목록에 없는 키워드 '{key}'")

    for p, tree in files.items():
        is_mod_file = os.sep + "static_modifiers" + os.sep in p
        if is_mod_file:
            continue
        walk(tree, lambda k, o, v, l, par, p=p: check(k, o, v, l, par, p))

    # 현지화 키 목록
    for e, names in event_opts.items():
        loc_needed |= {f"{e}.t", f"{e}.d", f"{e}.f"}
        loc_needed |= set(names)
    for j in jes:
        loc_needed |= {j, f"{j}_reason"}
    for d in decisions:
        loc_needed |= {d, f"{d}_desc"}
    for m in modifiers:
        loc_needed |= {m, f"{m}_desc"}

    loc_dir = os.path.join(args.mod_dir, "localization")
    for lang in sorted(os.listdir(loc_dir)) if os.path.isdir(loc_dir) else []:
        have = {}
        for root, _, names in os.walk(os.path.join(loc_dir, lang)):
            for n in names:
                if not n.endswith(".yml"):
                    continue
                p = os.path.join(root, n)
                raw = open(p, "rb").read()
                if not raw.startswith(b"\xef\xbb\xbf"):
                    errors.append(f"{p}: UTF-8 BOM 없음 (게임이 인식하지 못함)")
                if not n.endswith(f"_l_{lang}.yml"):
                    errors.append(f"{p}: 파일명이 _l_{lang}.yml 로 끝나야 함")
                lines = raw.decode("utf-8-sig").splitlines()
                if not lines or lines[0].strip() != f"l_{lang}:":
                    errors.append(f"{p}: 첫 줄이 'l_{lang}:' 이어야 함")
                for i, line in enumerate(lines[1:], 2):
                    if not line.strip() or line.strip().startswith("#"):
                        continue
                    m = LOC_LINE_RE.match(line)
                    if not m:
                        errors.append(f"{p}:{i}: 현지화 형식 오류: {line[:60]}")
                        continue
                    if m.group(1) in have:
                        warnings.append(f"{p}:{i}: 중복 키 '{m.group(1)}'")
                    have[m.group(1)] = m.group(2)
        missing = sorted(k for k in loc_needed if k not in have)
        for k in missing:
            errors.append(f"[{lang}] 현지화 누락: {k}")
        unused = sorted(k for k in have if k not in loc_needed and not k.startswith("jfp_tt_") and not k.startswith("jfp_name_"))
        for k in unused:
            warnings.append(f"[{lang}] 사용되지 않는 현지화 키: {k}")

    print(f"이벤트 {len(events)} / 저널 {len(jes)} / 결정 {len(decisions)} / 수정자 {len(modifiers)} / "
          f"스크립트 효과 {len(s_effects)} / 트리거 {len(s_triggers)}")
    for w in warnings:
        print("경고:", w)
    for e in errors:
        print("오류:", e)
    print(f"오류 {len(errors)}건, 경고 {len(warnings)}건")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
