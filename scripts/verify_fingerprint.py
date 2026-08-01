#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_fingerprint.py - Tạo và xác minh dấu vân tay (snapshot + SHA-256 hash)
của toàn bộ 379 câu hỏi trong data/questions.json theo đúng Yêu cầu số 1.
"""

import json
import hashlib
import sys
import io
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
elif hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = ROOT_DIR / "data" / "questions.json"
SNAPSHOT_PATH = ROOT_DIR / "data" / "questions_snapshot.json"
FINGERPRINT_PATH = ROOT_DIR / "data" / "questions_fingerprint.txt"

FIELDS = [
    "id", "order", "sectionId", "standard", "bloomLevel",
    "topic", "stem", "options", "correctOptionId",
    "explanation", "sourceText", "images"
]

def extract_questions_data(data):
    questions = data.get("questions", [])
    extracted = []
    for q in sorted(questions, key=lambda x: x.get("order", 0)):
        item = {}
        for k in FIELDS:
            if k in q:
                item[k] = q[k]
            else:
                item[k] = None
        extracted.append(item)
    return extracted

def compute_hash(extracted_list):
    content_str = json.dumps(extracted_list, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content_str.encode('utf-8')).hexdigest()

def make_snapshot():
    if not QUESTIONS_PATH.exists():
        print(f"LỖI: Không tìm thấy {QUESTIONS_PATH}")
        sys.exit(1)
    
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    extracted = extract_questions_data(data)
    sha_hash = compute_hash(extracted)
    
    with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
        json.dump({"sha256": sha_hash, "count": len(extracted), "questions": extracted}, f, ensure_ascii=False, indent=2)
        
    with open(FINGERPRINT_PATH, "w", encoding="utf-8") as f:
        f.write(sha_hash)
        
    print(f"Đã tạo snapshot thành công!")
    print(f"  Số câu hỏi: {len(extracted)}")
    print(f"  SHA-256 fingerprint: {sha_hash}")

def verify_snapshot():
    if not SNAPSHOT_PATH.exists() or not QUESTIONS_PATH.exists():
        print(f"LỖI: Thiếu file snapshot hoặc questions.json")
        sys.exit(1)
        
    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
        snapshot_doc = json.load(f)
    expected_hash = snapshot_doc["sha256"]
    
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    extracted = extract_questions_data(data)
    current_hash = compute_hash(extracted)
    
    if len(extracted) != snapshot_doc["count"]:
        print(f"LỖI: Số lượng câu hỏi thay đổi! Cũ={snapshot_doc['count']}, Mới={len(extracted)}")
        sys.exit(1)
        
    if current_hash != expected_hash:
        print(f"LỖI: SHA-256 fingerprint không khớp!")
        print(f"  Expected: {expected_hash}")
        print(f"  Current : {current_hash}")
        # Tìm chi tiết câu hỏi bị khác
        for i, (old_q, new_q) in enumerate(zip(snapshot_doc["questions"], extracted)):
            if old_q != new_q:
                print(f"  Khác biệt tại câu ID={old_q.get('id')}:")
                for k in FIELDS:
                    if old_q.get(k) != new_q.get(k):
                        print(f"    Trường '{k}' khác nhau:\n      Cũ: {old_q.get(k)}\n      Mới: {new_q.get(k)}")
        sys.exit(1)
        
    print("XÁC MINH THÀNH CÔNG: Toàn bộ 379 câu hỏi và các trường dữ liệu khớp 100% với snapshot gốc!")
    print(f"  SHA-256 fingerprint: {current_hash}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        verify_snapshot()
    else:
        make_snapshot()
