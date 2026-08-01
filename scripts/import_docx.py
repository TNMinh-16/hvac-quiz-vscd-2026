#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_docx.py – Trích xuất 3000 câu hỏi HVAC_ASHRAE_VSCD_2026 từ file Word
                  → data/questions.json + data/import-report.json

Cách dùng:
    cd <project_root>
    pip install -r scripts/requirements.txt
    python scripts/import_docx.py

Styles dùng trong file Word (đã xác nhận từ explore_docx.py):
  Question Header  → "Q001  ·  ASHRAE 55-2023  ·  Topic EN / Topic VI"
  Stem English     → nội dung tiếng Anh của câu hỏi
  Stem Vietnamese  → nội dung tiếng Việt của câu hỏi
  Figure Caption   → chú thích hình ảnh
  Option           → "A. ... \\nVI: ..."
  Answer Header    → "Q001  ·  ĐÁP ÁN B  ·  Topic"
  Answer Text      → "Correct answer / Đáp án đúng: ..."
  Explanation      → "Giải thích: ..."
  Source Line      → "Nguồn / Source: ..."
  Small Note       → ghi chú nhỏ
  Heading 1/2      → phân mục
  Normal           → văn bản thường
"""

import sys
import io
import os
import re
import json
import hashlib
import datetime
import traceback
from pathlib import Path

# Force UTF-8 stdout for Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

try:
    from docx import Document
    from docx.oxml.ns import qn
except ImportError:
    print("ERROR: Thư viện python-docx chưa được cài. Chạy:")
    print("  pip install -r scripts/requirements.txt")
    sys.exit(1)

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DOCX_NAME    = "HVAC_Competition_1000_Questions_Bloom_EN-VI.docx"
DOCX_PATH    = PROJECT_ROOT / DOCX_NAME
DATA_DIR     = PROJECT_ROOT / "data"
IMG_DIR      = PROJECT_ROOT / "public" / "assets" / "questions"
QUESTIONS_JSON = DATA_DIR / "questions.json"
REPORT_JSON    = DATA_DIR / "import-report.json"

EXPECTED_COUNT = 1000

# ─── Validate DOCX exists ─────────────────────────────────────────────────────
if not DOCX_PATH.exists():
    candidates = list(PROJECT_ROOT.glob("*.docx"))
    if candidates:
        DOCX_PATH = candidates[0]
        print(f"WARNING: Không tìm thấy '{DOCX_NAME}', dùng '{DOCX_PATH.name}'")
    else:
        print(f"ERROR: Không tìm thấy file Word '{DOCX_NAME}' trong {PROJECT_ROOT}")
        sys.exit(1)

DATA_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

# ─── SHA-256 ──────────────────────────────────────────────────────────────────
def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

# ─── Regex ────────────────────────────────────────────────────────────────────
# Question Header: "Q001  ·  ASHRAE 55-2023  ·  Topic EN / Topic VI"
QH_RE = re.compile(
    r"^(Q\d{1,4})\s*[·\-]\s*(ASHRAE\s+[\d.]+(?:-\d+)?(?:\s+\w+)*|[\w.\s]+?)\s*[·\-]\s*(.+)$",
    re.IGNORECASE
)

# Answer Header: "Q001  ·  ĐÁP ÁN B  ·  Topic"
AH_RE = re.compile(
    r"^(Q\d{1,4})\s*[·\-]\s*(?:ĐÁP\s*ÁN|CORRECT\s*ANSWER|ANSWER)\s+([A-D])\s*[·\-]?\s*(.*)$",
    re.IGNORECASE
)

# Option: "A. Text...\nVI: Text VI..."  or "A. Text..."
OPT_RE = re.compile(r"^([A-D])[.)]\s+(.+)$", re.DOTALL)

# Correct Answer line (Answer Text style)
CORRECT_TEXT_RE = re.compile(r"(?:correct\s*answer|đáp\s*án\s*đúng)[:\s]+(.+)", re.IGNORECASE | re.DOTALL)

# Explanation
EXPL_RE = re.compile(r"^(?:giải\s*thích|explanation)[:\s]+(.+)$", re.IGNORECASE | re.DOTALL)

# Source
SRC_RE = re.compile(r"^(?:nguồn|source)[^:]*:\s*(.+)$", re.IGNORECASE)

# Heading bloom / standard
BLOOM_H_RE = re.compile(r"BLOOM\s+(\d)\s*[·\-]\s*(REMEMBER|UNDERSTAND|APPLY|ANALYZE|EVALUATE|CREATE)", re.IGNORECASE)
STD_H_RE   = re.compile(r"(ASHRAE\s+[\d.]+(?:-\d+)?)", re.IGNORECASE)

# ─── Extract images ───────────────────────────────────────────────────────────
def extract_all_images(doc) -> tuple:
    """Trích xuất tất cả ảnh nhúng vào bộ nhớ. Trả về (img_paths, img_blobs)"""
    img_paths = {}
    img_blobs = {}
    img_counter = 0
    rels = doc.part.rels
    ext_map = {
        "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif",
        "image/bmp": "bmp", "image/tiff": "tif", "image/wmf": "wmf", "image/emf": "emf",
    }
    for rId, rel in rels.items():
        if "image" in rel.reltype.lower():
            img_counter += 1
            try:
                img_part = rel.target_part
                ext = ext_map.get(img_part.content_type, "png")
                fname = f"img_{img_counter:04d}.{ext}"
                web_path = f"/assets/questions/{fname}"
                img_paths[rId] = web_path
                img_blobs[web_path] = (fname, img_part.blob)
            except Exception as e:
                print(f"  WARNING img rId={rId}: {e}")
    return img_paths, img_blobs

def get_para_image_rids(para) -> list:
    """Trả về rIds của ảnh trong paragraph."""
    rids = []
    for elem in para._p.iter():
        if elem.tag == qn("a:blip"):
            rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            if rid:
                rids.append(rid)
        if "imagedata" in elem.tag.lower():
            rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            if rid:
                rids.append(rid)
    return rids

def para_full_text(para) -> str:
    """Lấy text kể cả line breaks trong run."""
    parts = []
    for elem in para._p.iter():
        if elem.tag == qn("w:t"):
            parts.append(elem.text or "")
        elif elem.tag == qn("w:br"):
            parts.append("\n")
        elif elem.tag == qn("w:tab"):
            parts.append("\t")
    return "".join(parts)

# ─── Option & Table parsers ───────────────────────────────────────────────────
def normalize_std(raw: str) -> str:
    if "52.2" in raw: return "ASHRAE 52.2"
    if "55" in raw: return "ASHRAE 55"
    if "62.1" in raw: return "ASHRAE 62.1"
    if "90.1" in raw: return "ASHRAE 90.1"
    if "HVAC" in raw: return "HVAC Fundamentals"
    return raw

def normalize_bloom(raw: str) -> str:
    for b in ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]:
        if b.lower() in raw.lower():
            return b
    return raw

def split_en_vi(txt: str) -> tuple:
    if "  /  " in txt:
        parts = txt.split("  /  ", 1)
        return parts[0].strip(), parts[1].strip()
    elif " / " in txt and not re.search(r'\d\s*/\s*\d', txt):
        parts = txt.split(" / ", 1)
        return parts[0].strip(), parts[1].strip()
    else:
        return txt.strip(), ""

def get_table_content_and_images(tbl) -> tuple:
    lines = []
    rids = []
    for row in tbl.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                txt = p.text.strip()
                if txt:
                    lines.append(txt)
                for elem in p._p.iter():
                    if elem.tag == qn("a:blip"):
                        rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
                        if rid and rid not in rids:
                            rids.append(rid)
                    if "imagedata" in elem.tag.lower():
                        rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                        if rid and rid not in rids:
                            rids.append(rid)
    return lines, rids

# ─── Main Parse ───────────────────────────────────────────────────────────────
def parse_docx(doc_path: Path):
    doc = Document(str(doc_path))
    warnings = []
    
    print("  Trích xuất ảnh nhúng...")
    img_map, img_blobs = extract_all_images(doc)
    print(f"  Đã trích xuất {len(img_map)} ảnh")
    
    sections = []
    root_sec_id = "sec-001"
    sections.append({
        "id": root_sec_id, "order": 1, "titleEn": "PHẦN I · ĐỀ TRẮC NGHIỆM", "titleVi": "PHẦN I · ĐỀ TRẮC NGHIỆM",
        "level": 0, "bloomLevel": None, "standard": None, "parentId": None, "questionIds": []
    })
    
    sec_counter = 1
    bloom_list = [
        ("Remember", "Questions — Remember", "Câu hỏi — Ghi nhớ"),
        ("Understand", "Questions — Understand", "Câu hỏi — Thông hiểu"),
        ("Apply", "Questions — Apply", "Câu hỏi — Vận dụng"),
        ("Analyze", "Questions — Analyze", "Câu hỏi — Phân tích"),
        ("Evaluate", "Questions — Evaluate", "Câu hỏi — Đánh giá"),
        ("Create", "Questions — Create", "Câu hỏi — Sáng tạo")
    ]
    std_list = ["ASHRAE 52.2", "ASHRAE 55", "ASHRAE 62.1", "ASHRAE 90.1", "HVAC Fundamentals"]
    
    sec_map = {}
    for bloom_code, title_en, title_vi in bloom_list:
        sec_counter += 1
        bloom_sec_id = f"sec-{sec_counter:03d}"
        sections.append({
            "id": bloom_sec_id, "order": sec_counter, "titleEn": title_en, "titleVi": title_vi,
            "level": 1, "bloomLevel": bloom_code, "standard": None, "parentId": root_sec_id, "questionIds": []
        })
        for std in std_list:
            sec_counter += 1
            std_sec_id = f"sec-{sec_counter:03d}"
            sections.append({
                "id": std_sec_id, "order": sec_counter, "titleEn": std, "titleVi": std,
                "level": 2, "bloomLevel": bloom_code, "standard": std, "parentId": bloom_sec_id, "questionIds": []
            })
            sec_map[(bloom_code, std)] = std_sec_id

    print("  Đọc và phân tích 1000 bảng câu hỏi...")
    questions = []
    q_order_counter = 0
    
    for tbl in doc.tables:
        lines, rids = get_table_content_and_images(tbl)
        if not lines or not re.match(r"^Q\d{4}", lines[0]):
            continue
        
        q_order_counter += 1
        header = lines[0]
        parts = [p.strip() for p in re.split(r"[•·]", header)]
        qid = parts[0]
        std = normalize_std(parts[2] if len(parts) > 2 else "")
        bloom = normalize_bloom(parts[3] if len(parts) > 3 else "")
        
        topic_en, topic_vi = split_en_vi(lines[1] if len(lines) > 1 else "")
        stem_en = lines[2] if len(lines) > 2 else ""
        stem_vi = lines[3] if len(lines) > 3 else ""
        
        options = []
        opt_line_indices = []
        for i, l in enumerate(lines):
            m = re.match(r"^([A-D])[.)]\s+(.+)$", l, re.DOTALL)
            if m:
                let = m.group(1).upper()
                o_en, o_vi = split_en_vi(m.group(2))
                options.append({"id": let, "en": o_en, "vi": o_vi})
                opt_line_indices.append(i)
                
        correct_opt = ""
        ans_idx = -1
        for i, l in enumerate(lines):
            if opt_line_indices and i > max(opt_line_indices):
                m = re.search(r"(?:ĐÁP ÁN|ANSWER)[:\s]+([A-D])", l, re.IGNORECASE)
                if m:
                    correct_opt = m.group(1).upper()
                    ans_idx = i
                    break
        
        source_text = ""
        expl_lines = []
        if ans_idx != -1:
            for i in range(ans_idx + 1, len(lines)):
                l = lines[i]
                if any(l.lower().startswith(p) for p in ["nguồn / reference:", "reference:", "nguồn:"]):
                    source_text = l.split(":", 1)[1].strip()
                else:
                    expl_lines.append(l)
                    
        expl_vi = expl_lines[0] if len(expl_lines) > 0 else ""
        expl_en = expl_lines[1] if len(expl_lines) > 1 else ""
        if len(expl_lines) > 2:
            expl_en = " ".join(expl_lines[1:])
            
        q_images = []
        for rid in rids:
            if rid in img_map and img_map[rid] not in q_images:
                q_images.append(img_map[rid])
                
        sec_id = sec_map.get((bloom, std), "sec-000")
        
        question = {
            "id": qid,
            "order": q_order_counter,
            "sectionId": sec_id,
            "standard": std,
            "bloomLevel": bloom,
            "topic": {"en": topic_en, "vi": topic_vi},
            "stem": {"en": stem_en, "vi": stem_vi},
            "options": options,
            "correctOptionId": correct_opt,
            "explanation": {"en": expl_en, "vi": expl_vi},
            "sourceText": source_text,
            "images": q_images
        }
        questions.append(question)
        
        for s in sections:
            if s["id"] == sec_id:
                s["questionIds"].append(qid)
                break

    return sections, questions, warnings, img_map, img_blobs

# ─── Validation ───────────────────────────────────────────────────────────────
def validate(questions, sections, warnings, img_blobs):
    errors = []
    
    if len(questions) != EXPECTED_COUNT:
        errors.append(
            f"Số câu không đúng: mong đợi {EXPECTED_COUNT}, thực tế {len(questions)}"
        )
    
    ids = [q["id"] for q in questions]
    dup = [qid for qid in set(ids) if ids.count(qid) > 1]
    if dup:
        errors.append(f"ID trùng nhau: {dup}")
        
    root_secs = [s for s in sections if s["level"] == 0]
    bloom_secs = [s for s in sections if s["level"] == 1]
    std_secs = [s for s in sections if s["level"] == 2]
    
    if len(root_secs) != 1:
        errors.append(f"Cấu trúc section: mong đợi 1 Root level 0, thực tế {len(root_secs)}")
    if len(bloom_secs) != 6:
        errors.append(f"Cấu trúc section: mong đợi 6 Bloom level 1, thực tế {len(bloom_secs)}")
    if len(std_secs) != 30:
        errors.append(f"Cấu trúc section: mong đợi 30 Standard level 2, thực tế {len(std_secs)}")
    if len(sections) != 37:
        errors.append(f"Cấu trúc section: mong đợi tổng 37 section, thực tế {len(sections)}")
        
    for s in sections:
        if s["level"] == 0 and s["parentId"] is not None:
            errors.append(f"Section {s['id']} (level 0) phải có parentId=null")
        if s["level"] == 1 and (not s["parentId"] or s["parentId"] != root_secs[0]["id"]):
            errors.append(f"Section {s['id']} (level 1) có parentId sai: {s['parentId']}")
        if s["level"] == 2 and not any(b["id"] == s["parentId"] for b in bloom_secs):
            errors.append(f"Section {s['id']} (level 2) có parentId không trỏ đến Bloom: {s['parentId']}")

    bloom_counts = {}
    std_counts = {}
    for q in questions:
        b = q["bloomLevel"]
        std = q["standard"]
        bloom_counts[b] = bloom_counts.get(b, 0) + 1
        std_counts[std] = std_counts.get(std, 0) + 1
        
    expected_blooms = {
        "Remember": 260, "Understand": 240, "Apply": 260,
        "Analyze": 150, "Evaluate": 70, "Create": 20
    }
    for b, count in expected_blooms.items():
        if bloom_counts.get(b, 0) != count:
            errors.append(f"Số câu Bloom '{b}' sai: mong đợi {count}, thực tế {bloom_counts.get(b, 0)}")

    expected_stds = {
        "ASHRAE 90.1": 270, "ASHRAE 62.1": 220,
        "ASHRAE 52.2": 170, "ASHRAE 55": 180, "HVAC Fundamentals": 160
    }
    for std, count in expected_stds.items():
        if std_counts.get(std, 0) != count:
            errors.append(f"Số câu Tiêu chuẩn '{std}' sai: mong đợi {count}, thực tế {std_counts.get(std, 0)}")

    if len(img_blobs) != 28:
        errors.append(f"Số file ảnh trích xuất không đúng: mong đợi 28, thực tế {len(img_blobs)}")
    
    total_img_refs = sum(len(q["images"]) for q in questions)
    if total_img_refs != 211:
        errors.append(f"Tổng số liên kết ảnh–câu không đúng: mong đợi 211, thực tế {total_img_refs}")

    used_images = set()
    for q in questions:
        qid = q["id"]
        for img_path in q["images"]:
            used_images.add(img_path)
            if img_path not in img_blobs:
                errors.append(f"{qid}: Ảnh bị gắn không tồn tại trong tập trích xuất: {img_path}")

    if len(used_images) != 26:
        errors.append(f"Số ảnh nội dung được dùng trong câu hỏi không đúng: mong đợi 26, thực tế {len(used_images)}")

    for q in questions:
        qid = q["id"]
        opt_ids = [o["id"] for o in q["options"]]
        
        if len(q["options"]) != 4:
            errors.append(f"{qid}: Số phương án = {len(q['options'])} (phải 4): {opt_ids}")
        
        for o in q["options"]:
            if not o["id"] in ["A", "B", "C", "D"]:
                errors.append(f"{qid}: Phương án không hợp lệ {o['id']}")
            if not o.get("en") or not o.get("vi"):
                errors.append(f"{qid}: Phương án {o['id']} thiếu tiếng Anh hoặc tiếng Việt")
        
        for letter in ["A", "B", "C", "D"]:
            if letter not in opt_ids:
                errors.append(f"{qid}: Thiếu phương án {letter}")
        
        if not q["correctOptionId"]:
            errors.append(f"{qid}: Không có đáp án đúng")
        elif q["correctOptionId"] not in opt_ids:
            errors.append(f"{qid}: correctOptionId='{q['correctOptionId']}' không tồn tại: {opt_ids}")
        
        if not q["explanation"]["en"] or not q["explanation"]["vi"]:
            errors.append(f"{qid}: Thiếu lời giải thích (phải đủ EN và VI)")
        
        if not q["stem"]["en"] or not q["stem"]["vi"]:
            errors.append(f"{qid}: Thiếu nội dung stem câu hỏi (phải đủ EN và VI)")
        elif not q["stem"]["en"]:
            warnings.append(f"{qid}: Thiếu stem EN")
        elif not q["stem"]["vi"]:
            warnings.append(f"{qid}: Thiếu stem VI")
    
    return errors

# ─── Build Report ─────────────────────────────────────────────────────────────
def build_report(docx_path, sections, questions, warnings, errors, img_count):
    sha = sha256_file(docx_path)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    
    sec_dist = {}
    for s in sections:
        sec_dist[s["id"]] = {"title": s["titleEn"], "count": len(s["questionIds"])}
    
    bloom_dist = {}
    for q in questions:
        b = q["bloomLevel"] or "Unknown"
        bloom_dist[b] = bloom_dist.get(b, 0) + 1
    
    std_dist = {}
    for q in questions:
        s = q["standard"] or "Unknown"
        std_dist[s] = std_dist.get(s, 0) + 1
    
    return {
        "sourceFile": docx_path.name,
        "sha256": sha,
        "importedAt": now,
        "questionCount": len(questions),
        "sectionCount": len(sections),
        "imageCount": img_count,
        "distributionBySection": sec_dist,
        "distributionByBloom": bloom_dist,
        "distributionByStandard": std_dist,
        "warnings": warnings,
        "errors": errors,
        "status": "OK" if not errors else "FAILED",
    }

# ─── Safe JSON write ──────────────────────────────────────────────────────────
def safe_write_json(path: Path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    if path.exists():
        backup = path.with_suffix(path.suffix + ".bak")
        path.replace(backup)
    tmp.replace(path)

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("HVAC Quiz – Import DOCX → questions.json")
    print("=" * 70)
    print(f"File nguồn : {DOCX_PATH}")
    print(f"Thư mục ảnh: {IMG_DIR}")
    print(f"Output     : {QUESTIONS_JSON}")
    print()
    
    print("Bước 1: Phân tích file Word...")
    try:
        sections, questions, warnings, img_map, img_blobs = parse_docx(DOCX_PATH)
    except Exception as e:
        print(f"ERROR: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    print(f"  ✓ {len(sections)} phần")
    print(f"  ✓ {len(questions)} câu hỏi")
    print(f"  ✓ {len(img_blobs)} ảnh")
    print()
    
    print("Bước 2: Kiểm tra dữ liệu...")
    errors = validate(questions, sections, warnings, img_blobs)
    
    ok_count = sum(1 for q in questions if len(q["options"]) == 4 and q["correctOptionId"])
    print(f"  Câu hỏi đạt yêu cầu : {ok_count}/{len(questions)}")
    
    if errors:
        print(f"  LỖI ({len(errors)}):")
        for e in errors[:30]:
            print(f"    ✗ {e}")
        if len(errors) > 30:
            print(f"    ... và {len(errors) - 30} lỗi khác")
    else:
        print("  ✓ Không có lỗi nghiêm trọng")
    
    if warnings:
        print(f"  CẢNH BÁO ({min(len(warnings), 20)}/{len(warnings)}):")
        for w in warnings[:20]:
            print(f"    ⚠ {w}")
    print()
    
    print("Bước 3: Ghi báo cáo nhập dữ liệu...")
    report = build_report(DOCX_PATH, sections, questions, warnings, errors, len(img_blobs))
    safe_write_json(REPORT_JSON, report)
    print(f"  ✓ {REPORT_JSON}")
    
    print("=" * 70)
    if errors:
        print(f"KẾT QUẢ: THẤT BẠI ({len(errors)} lỗi)")
        print("  Không ghi đè questions.json hay xóa/thay đổi ảnh do kiểm tra thất bại.")
        print("  Xem chi tiết: data/import-report.json")
        sys.exit(1)
        
    print("Bước 4: Lưu hình ảnh và dữ liệu hợp lệ...")
    valid_fnames = set()
    for web_path, (fname, blob) in img_blobs.items():
        dest = IMG_DIR / fname
        with open(dest, "wb") as f:
            f.write(blob)
        valid_fnames.add(fname)
        
    for fpath in IMG_DIR.glob("*.*"):
        if fpath.is_file() and fpath.name not in valid_fnames:
            try:
                fpath.unlink()
                print(f"  Đã xóa ảnh cũ không sử dụng: {fpath.name}")
            except Exception as e:
                print(f"  Cảnh báo: không xóa được {fpath.name}: {e}")
                
    sha = sha256_file(DOCX_PATH)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    
    output = {
        "schemaVersion": 1,
        "source": {
            "fileName": DOCX_PATH.name,
            "sha256": sha,
            "importedAt": now,
            "questionCount": len(questions),
        },
        "sections": sections,
        "questions": questions,
    }
    
    safe_write_json(QUESTIONS_JSON, output)
    print(f"  ✓ {QUESTIONS_JSON}")
    print()
    
    print("KẾT QUẢ: THÀNH CÔNG")
    print(f"  Câu hỏi : {len(questions)}")
    print(f"  Phần    : {len(sections)}")
    print(f"  Ảnh     : {len(img_blobs)}")
    print()
    print("Chạy tiếp:")
    print("  npm run dev")
    print("=" * 70)

if __name__ == "__main__":
    main()
