#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_docx.py – Trích xuất 304 câu hỏi HVAC_ASHRAE_VSCD_2026 từ file Word
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
DOCX_NAME    = "HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx"
DOCX_PATH    = PROJECT_ROOT / DOCX_NAME
DATA_DIR     = PROJECT_ROOT / "data"
IMG_DIR      = PROJECT_ROOT / "public" / "assets" / "questions"
QUESTIONS_JSON = DATA_DIR / "questions.json"
REPORT_JSON    = DATA_DIR / "import-report.json"

EXPECTED_COUNT = 304

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

# ─── Option parser ────────────────────────────────────────────────────────────
def parse_option(raw_text: str) -> dict:
    """
    Parse option text có dạng:
      "A. English text\nVI: Vietnamese text"
    hay
      "A. English text"
    Trả về {"id": "A", "en": "...", "vi": "..."}
    """
    raw_text = raw_text.strip()
    m = OPT_RE.match(raw_text)
    if not m:
        return None
    letter = m.group(1).upper()
    body = m.group(2).strip()
    
    # Tách EN và VI
    # Mẫu: "English text\nVI: Vietnamese"
    vi_match = re.search(r"\nVI:\s*(.+)$", body, re.DOTALL | re.IGNORECASE)
    if vi_match:
        en_text = body[:vi_match.start()].strip()
        vi_text = vi_match.group(1).strip()
    else:
        # Thử dạng "English text / Vietnamese text"
        slash_match = re.search(r"\s*/\s*(.+)$", body)
        if slash_match:
            en_text = body[:slash_match.start()].strip()
            vi_text = slash_match.group(1).strip()
        else:
            en_text = body
            vi_text = ""
    
    return {"id": letter, "en": en_text, "vi": vi_text}

# ─── Parse Question Header ────────────────────────────────────────────────────
def parse_question_header(txt: str):
    """
    Trả về (qid, standard, topic_en, topic_vi) hoặc None.
    Mẫu: "Q001  ·  ASHRAE 55-2023  ·  Purpose and factors / Mục đích và các yếu tố"
    """
    txt = txt.strip()
    # Chia theo dấu ·
    parts = re.split(r"\s*[·]\s*", txt)
    if len(parts) < 2:
        return None
    
    qid_raw = parts[0].strip()
    if not re.match(r"^Q\d+$", qid_raw, re.IGNORECASE):
        return None
    
    qid = f"Q{int(qid_raw[1:]):03d}"
    standard = parts[1].strip() if len(parts) > 1 else ""
    
    topic_raw = parts[2].strip() if len(parts) > 2 else ""
    # Tách topic EN / VI
    topic_parts = re.split(r"\s*/\s*", topic_raw, maxsplit=1)
    topic_en = topic_parts[0].strip()
    topic_vi = topic_parts[1].strip() if len(topic_parts) > 1 else ""
    
    return qid, standard, topic_en, topic_vi

def parse_answer_header(txt: str):
    """
    Trả về (qid, correct_letter) hoặc None.
    Mẫu: "Q001  ·  ĐÁP ÁN B  ·  Topic"
    """
    txt = txt.strip()
    m = re.match(r"^(Q\d+)\s*[·\-]\s*(?:ĐÁP\s*ÁN|CORRECT(?:\s*ANSWER)?)\s+([A-D])", txt, re.IGNORECASE)
    if m:
        qid_raw = m.group(1)
        qid = f"Q{int(qid_raw[1:]):03d}"
        letter = m.group(2).upper()
        return qid, letter
    return None

# ─── Main Parse ───────────────────────────────────────────────────────────────
def parse_docx(doc_path: Path):
    doc = Document(str(doc_path))
    warnings = []
    
    print("  Trích xuất ảnh nhúng...")
    img_map, img_blobs = extract_all_images(doc)
    print(f"  Đã trích xuất {len(img_map)} ảnh")
    
    paras = doc.paragraphs
    print(f"  Tổng số paragraph: {len(paras)}")
    
    # ── PASS 1: Thu thập câu hỏi (phần I) ─────────────────────────────────
    questions_raw = {}   # qid -> dict
    sections = []
    q_order_counter = 0
    
    current_bloom = ""
    current_standard = ""
    current_section_id = None
    section_counter = 0
    root_sec_id = None
    curr_bloom_sec_id = None
    
    # Heading stack: track current section hierarchy
    in_questions_part = False
    
    i = 0
    while i < len(paras):
        para = paras[i]
        style = para.style.name
        txt = para_full_text(para).strip()
        img_rids = get_para_image_rids(para)
        
        # ── Heading ──────────────────────────────────────────────────────
        if style.startswith("Heading"):
            if "PHẦN II" in txt or "ĐÁP ÁN" in txt.upper():
                in_questions_part = False
            elif "PHẦN I" in txt:
                in_questions_part = True
            
            # Detect Bloom level from heading
            bm = BLOOM_H_RE.search(txt)
            if bm:
                bloom_en  = bm.group(2).capitalize()
                current_bloom = f"{bloom_en}"
            
            # Detect standard from sub-heading
            sm = STD_H_RE.search(txt)
            if sm and style == "Heading 2":
                current_standard = sm.group(1).strip()
            
            if in_questions_part and txt:
                section_counter += 1
                sec_id = f"sec-{section_counter:03d}"
                
                # Determine hierarchy level and parentId
                if "PHẦN I" in txt or section_counter == 1:
                    lvl = 0
                    parent_id = None
                    root_sec_id = sec_id
                elif bm or "BLOOM" in txt.upper() or style == "Heading 1":
                    lvl = 1
                    parent_id = root_sec_id
                    curr_bloom_sec_id = sec_id
                else:
                    lvl = 2
                    parent_id = curr_bloom_sec_id
                
                sec = {
                    "id": sec_id,
                    "order": section_counter,
                    "titleEn": txt,
                    "titleVi": txt,
                    "level": lvl,
                    "bloomLevel": current_bloom if lvl > 0 else None,
                    "standard": current_standard if lvl == 2 else None,
                    "parentId": parent_id,
                    "questionIds": [],
                }
                sections.append(sec)
                current_section_id = sec["id"]
            
            i += 1
            continue
        
        # ── Question Header ────────────────────────────────────────────────
        if style == "Question Header" and txt:
            parsed = parse_question_header(txt)
            if parsed:
                qid, std, topic_en, topic_vi = parsed
                q_order_counter += 1
                questions_raw[qid] = {
                    "id": qid,
                    "order": q_order_counter,
                    "sectionId": current_section_id or "sec-000",
                    "standard": std or current_standard,
                    "bloomLevel": current_bloom,
                    "topic": {"en": topic_en, "vi": topic_vi},
                    "stem": {"en": "", "vi": ""},
                    "options": [],
                    "correctOptionId": "",
                    "explanation": {"en": "", "vi": ""},
                    "sourceText": "",
                    "images": [],
                    "_cur_qid": qid,
                }
                # Add to section
                if current_section_id:
                    for sec in sections:
                        if sec["id"] == current_section_id:
                            sec["questionIds"].append(qid)
                            break
                # Ảnh trong chính dòng Question Header
                for rid in img_rids:
                    if rid in img_map:
                        questions_raw[qid]["images"].append(img_map[rid])
            i += 1
            continue
        
        # ── Stem English ───────────────────────────────────────────────────
        if style == "Stem English" and txt:
            # Gắn vào câu hỏi gần nhất (order = q_order_counter)
            # Tìm câu hỏi có order = q_order_counter
            last_qid = f"Q{q_order_counter:03d}"
            if last_qid in questions_raw:
                questions_raw[last_qid]["stem"]["en"] = txt
                for rid in img_rids:
                    if rid in img_map:
                        wp = img_map[rid]
                        if wp not in questions_raw[last_qid]["images"]:
                            questions_raw[last_qid]["images"].append(wp)
            i += 1
            continue
        
        # ── Stem Vietnamese ────────────────────────────────────────────────
        if style == "Stem Vietnamese" and txt:
            last_qid = f"Q{q_order_counter:03d}"
            if last_qid in questions_raw:
                questions_raw[last_qid]["stem"]["vi"] = txt
                for rid in img_rids:
                    if rid in img_map:
                        wp = img_map[rid]
                        if wp not in questions_raw[last_qid]["images"]:
                            questions_raw[last_qid]["images"].append(wp)
            i += 1
            continue
        
        # ── Figure Caption ─────────────────────────────────────────────────
        if style == "Figure Caption" and txt:
            # Gắn ảnh với câu hỏi hiện tại
            last_qid = f"Q{q_order_counter:03d}"
            if last_qid in questions_raw:
                for rid in img_rids:
                    if rid in img_map:
                        wp = img_map[rid]
                        if wp not in questions_raw[last_qid]["images"]:
                            questions_raw[last_qid]["images"].append(wp)
                # Lưu caption vào stem hoặc không (không làm thay đổi nội dung)
            # Kiểm tra paragraph TRƯỚC figure caption có ảnh không
            # (ảnh thường ở paragraph Normal trước caption)
            if i > 0:
                prev_para = paras[i-1]
                prev_rids = get_para_image_rids(prev_para)
                if prev_rids and last_qid in questions_raw:
                    for rid in prev_rids:
                        if rid in img_map:
                            wp = img_map[rid]
                            if wp not in questions_raw[last_qid]["images"]:
                                questions_raw[last_qid]["images"].append(wp)
            i += 1
            continue
        
        # ── Option ────────────────────────────────────────────────────────
        if style == "Option" and txt:
            last_qid = f"Q{q_order_counter:03d}"
            if last_qid in questions_raw:
                opt = parse_option(txt)
                if opt:
                    # Kiểm tra trùng
                    existing = [o for o in questions_raw[last_qid]["options"] if o["id"] == opt["id"]]
                    if not existing:
                        questions_raw[last_qid]["options"].append(opt)
                    else:
                        warnings.append(f"{last_qid}: Trùng option {opt['id']}")
                else:
                    warnings.append(f"{last_qid}: Không parse được option: {repr(txt[:80])}")
            i += 1
            continue
        
        # ── Normal paragraph with images (inline images) ───────────────────
        if style == "Normal" and img_rids:
            last_qid = f"Q{q_order_counter:03d}"
            if last_qid in questions_raw:
                for rid in img_rids:
                    if rid in img_map:
                        wp = img_map[rid]
                        if wp not in questions_raw[last_qid]["images"]:
                            questions_raw[last_qid]["images"].append(wp)
            i += 1
            continue
        
        i += 1
    
    # ── PASS 2: Thu thập đáp án và giải thích (phần II) ───────────────────
    print("  Đọc phần II (đáp án và giải thích)...")
    in_answers_part = False
    current_ans_qid = None
    
    i = 0
    while i < len(paras):
        para = paras[i]
        style = para.style.name
        txt = para_full_text(para).strip()
        
        # Phát hiện bắt đầu phần II
        if style.startswith("Heading"):
            if "PHẦN II" in txt or "ĐÁP ÁN" in txt.upper():
                in_answers_part = True
        
        if not in_answers_part:
            i += 1
            continue
        
        # ── Answer Header ────────────────────────────────────────────────
        if style == "Answer Header" and txt:
            parsed_ah = parse_answer_header(txt)
            if parsed_ah:
                qid, letter = parsed_ah
                current_ans_qid = qid
                if qid in questions_raw:
                    questions_raw[qid]["correctOptionId"] = letter
                else:
                    warnings.append(f"Answer Header: {qid} không có trong danh sách câu hỏi")
            i += 1
            continue
        
        # ── Answer Text (chứa correct answer text) ────────────────────────
        if style == "Answer Text" and txt and current_ans_qid:
            i += 1
            continue
        
        # ── Explanation ───────────────────────────────────────────────────
        if style == "Explanation" and txt and current_ans_qid:
            if current_ans_qid in questions_raw:
                m_expl = EXPL_RE.match(txt)
                if m_expl:
                    expl_text = m_expl.group(1).strip()
                else:
                    expl_text = txt
                questions_raw[current_ans_qid]["explanation"]["vi"] = expl_text
                if not questions_raw[current_ans_qid]["explanation"]["en"]:
                    questions_raw[current_ans_qid]["explanation"]["en"] = expl_text
            i += 1
            continue
        
        # ── Source Line ───────────────────────────────────────────────────
        if style == "Source Line" and txt and current_ans_qid:
            if current_ans_qid in questions_raw:
                m_src = SRC_RE.match(txt)
                if m_src:
                    questions_raw[current_ans_qid]["sourceText"] = m_src.group(1).strip()
                else:
                    questions_raw[current_ans_qid]["sourceText"] = txt
            i += 1
            continue
        
        i += 1
    
    # Chuyển dict → list, sắp xếp theo order
    questions = sorted(questions_raw.values(), key=lambda q: q["order"])
    
    # Xóa field tạm
    for q in questions:
        q.pop("_cur_qid", None)
    
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
        
    # Kiểm tra section hierarchy
    root_secs = [s for s in sections if s["level"] == 0]
    bloom_secs = [s for s in sections if s["level"] == 1]
    std_secs = [s for s in sections if s["level"] == 2]
    
    if len(root_secs) != 1:
        errors.append(f"Cấu trúc section: mong đợi 1 Root level 0, thực tế {len(root_secs)}")
    if len(bloom_secs) != 6:
        errors.append(f"Cấu trúc section: mong đợi 6 Bloom level 1, thực tế {len(bloom_secs)}")
    if len(std_secs) != 24:
        errors.append(f"Cấu trúc section: mong đợi 24 Standard level 2, thực tế {len(std_secs)}")
    if len(sections) != 31:
        errors.append(f"Cấu trúc section: mong đợi tổng 31 section, thực tế {len(sections)}")
        
    # Kiểm tra parentId hợp lệ
    for s in sections:
        if s["level"] == 0 and s["parentId"] is not None:
            errors.append(f"Section {s['id']} (level 0) phải có parentId=null")
        if s["level"] == 1 and (not s["parentId"] or s["parentId"] != root_secs[0]["id"]):
            errors.append(f"Section {s['id']} (level 1) có parentId sai: {s['parentId']}")
        if s["level"] == 2 and not any(b["id"] == s["parentId"] for b in bloom_secs):
            errors.append(f"Section {s['id']} (level 2) có parentId không trỏ đến Bloom: {s['parentId']}")

    # Kiểm tra phân bố theo Bloom và Standard
    bloom_counts = {}
    std_counts = {}
    for q in questions:
        b = q["bloomLevel"]
        std = q["standard"]
        bloom_counts[b] = bloom_counts.get(b, 0) + 1
        std_counts[std] = std_counts.get(std, 0) + 1
        
    expected_blooms = {
        "Remember": 76, "Understand": 62, "Apply": 65,
        "Analyze": 46, "Evaluate": 35, "Create": 20
    }
    for b, count in expected_blooms.items():
        if bloom_counts.get(b, 0) != count:
            errors.append(f"Số câu Bloom '{b}' sai: mong đợi {count}, thực tế {bloom_counts.get(b, 0)}")

    expected_stds = {
        "ASHRAE 55-2023": 65, "ASHRAE 52.2": 70,
        "ASHRAE 62.1-2013": 35, "ASHRAE 90.1-2022": 134
    }
    for std, count in expected_stds.items():
        if std_counts.get(std, 0) != count:
            errors.append(f"Số câu Tiêu chuẩn '{std}' sai: mong đợi {count}, thực tế {std_counts.get(std, 0)}")

    # Kiểm tra ảnh
    if len(img_blobs) != 13:
        errors.append(f"Số file ảnh trích xuất không đúng: mong đợi 13, thực tế {len(img_blobs)}")
    
    total_img_refs = sum(len(q["images"]) for q in questions)
    if total_img_refs != 44:
        errors.append(f"Tổng số liên kết ảnh–câu không đúng: mong đợi 44, thực tế {total_img_refs}")

    used_images = set()
    for q in questions:
        qid = q["id"]
        for img_path in q["images"]:
            used_images.add(img_path)
            if "img_0001" in img_path:
                errors.append(f"{qid}: Ảnh bìa img_0001 bị gắn vào câu hỏi!")
            if img_path not in img_blobs:
                errors.append(f"{qid}: Ảnh bị gắn không tồn tại trong tập trích xuất: {img_path}")

    if len(used_images) != 12:
        errors.append(f"Số ảnh nội dung được dùng trong câu hỏi không đúng: mong đợi 12, thực tế {len(used_images)}")

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
