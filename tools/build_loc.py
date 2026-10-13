#!/usr/bin/env python3
"""현지화 파일 정리 스크립트.

1) localization/korean/*.yml 에 UTF-8 BOM을 붙입니다 (게임 인식 필수).
2) 영어 클라이언트용 대체 파일을 localization/english/ 에 생성합니다.
   (내용은 한국어 그대로이며, 영어 클라이언트에서는 한글 글꼴이 없어
    글자가 깨질 수 있습니다. 한국어로 플레이하는 것을 권장합니다.)

사용법: python3 tools/build_loc.py joseon_flavor
"""
import os
import sys

BOM = b"\xef\xbb\xbf"


def main(mod_dir):
    ko = os.path.join(mod_dir, "localization", "korean")
    en = os.path.join(mod_dir, "localization", "english")
    os.makedirs(en, exist_ok=True)
    for old in os.listdir(en):
        if old.startswith("jfp_") and old.endswith("_l_english.yml"):
            os.remove(os.path.join(en, old))
    for name in sorted(os.listdir(ko)):
        if not name.endswith("_l_korean.yml"):
            continue
        path = os.path.join(ko, name)
        text = open(path, "rb").read()
        if text.startswith(BOM):
            text = text[len(BOM):]
        body = text.decode("utf-8").replace("\r\n", "\n")
        open(path, "wb").write(BOM + body.encode("utf-8"))
        lines = body.split("\n")
        assert lines[0].strip() == "l_korean:", f"{name}: 첫 줄이 l_korean: 이 아님"
        lines[0] = "l_english:"
        out = os.path.join(en, name.replace("_l_korean.yml", "_l_english.yml"))
        open(out, "wb").write(BOM + "\n".join(lines).encode("utf-8"))
        print("생성:", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "joseon_flavor")
