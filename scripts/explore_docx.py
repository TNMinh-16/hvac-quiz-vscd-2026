#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from pathlib import Path
from docx import Document

import re
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

DOCX_PATH = Path(__file__).resolve().parent.parent / "HVAC_Standards_Challenge_3000_Bilingual_MCQs.docx"
doc = Document(str(DOCX_PATH))

def get_para_image_rids(para) -> list:
    rids = []
    for elem in para._p.iter():
        if elem.tag == qn("a:blip"):
            rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
            if rid: rids.append(rid)
        if "imagedata" in elem.tag.lower():
            rid = elem.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            if rid: rids.append(rid)
    return rids

def extract_all_images(doc):
    img_paths = {}
    img_counter = 0
    rels = doc.part.rels
    for rId, rel in rels.items():
        if "image" in rel.reltype.lower():
            img_counter += 1
            fname = f"img_{img_counter:04d}.png"
            web_path = f"/assets/questions/{fname}"
            img_paths[rId] = web_path
    return img_paths

img_map = extract_all_images(doc)
paras = doc.paragraphs

questions_raw = {}
sections = []
current_qid = None
current_bloom = ""
current_standard = ""
current_section_id = None
section_counter = 0

root_sec_id = "sec-001"
sections.append({
    "id": root_sec_id, "order": 1, "titleEn": "PHẦN I · ĐỀ TRẮC NGHIỆM", "titleVi": "PHẦN I · ĐỀ TRẮC NGHIỆM",
    "level": 0, "bloomLevel": None, "standard": None, "parentId": None, "questionIds": []
})
section_counter = 1
curr_bloom_sec_id = None

in_questions = False

for i, para in enumerate(paras):
    style = para.style.name
    txt = para.text.strip()
    img_rids = get_para_image_rids(para)
    
    if style == "Heading 1":
        if "Questions —" in txt or "Câu hỏi —" in txt:
            in_questions = True
            bloom_en = txt.split("—")[1].split("\n")[0].strip()
            current_bloom = bloom_en
            section_counter += 1
            sec_id = f"sec-{section_counter:03d}"
            curr_bloom_sec_id = sec_id
            sections.append({
                "id": sec_id, "order": section_counter, "titleEn": txt, "titleVi": txt,
                "level": 1, "bloomLevel": current_bloom, "standard": None, "parentId": root_sec_id, "questionIds": []
            })
            current_section_id = sec_id
        elif "Answer" in txt or "Đáp án" in txt:
            in_questions = False
        continue
        
    if style == "Heading 2" and in_questions:
        std_en = txt.split("—")[0].strip()
        current_standard = std_en
        section_counter += 1
        sec_id = f"sec-{section_counter:03d}"
        sections.append({
            "id": sec_id, "order": section_counter, "titleEn": txt, "titleVi": txt,
            "level": 2, "bloomLevel": current_bloom, "standard": current_standard, "parentId": curr_bloom_sec_id, "questionIds": []
        })
        current_section_id = sec_id
        continue
        
    if not in_questions:
        continue
        
    if style == "Question Meta" and txt:
        parts = [p.strip() for p in txt.split("•")]
        qid = parts[0]
        topic = parts[4] if len(parts) > 4 else ""
        t_en = topic.split("/")[0].strip() if "/" in topic else topic
        t_vi = topic.split("/")[1].strip() if "/" in topic else ""
        current_qid = qid
        questions_raw[qid] = {
            "id": qid, "sectionId": current_section_id, "standard": current_standard,
            "bloomLevel": current_bloom, "topic": {"en": t_en, "vi": t_vi},
            "stem": {"en": "", "vi": ""}, "options": {}, "correctOptionId": "",
            "explanation": {"en": "", "vi": ""}, "sourceText": "", "images": []
        }
        for sec in sections:
            if sec["id"] == current_section_id:
                sec["questionIds"].append(qid)
                
    if style == "Question EN" and txt and current_qid:
        questions_raw[current_qid]["stem"]["en"] = txt
    if style == "Question VI" and txt and current_qid:
        questions_raw[current_qid]["stem"]["vi"] = txt
    if style == "Option EN" and txt and current_qid:
        m = re.match(r"^([A-D])[.)]\s+(.+)$", txt, re.DOTALL)
        if m:
            let = m.group(1)
            if let not in questions_raw[current_qid]["options"]:
                questions_raw[current_qid]["options"][let] = {"id": let, "en": m.group(2).strip(), "vi": ""}
            else:
                questions_raw[current_qid]["options"][let]["en"] = m.group(2).strip()
    if style == "Option VI" and txt and current_qid:
        m = re.match(r"^([A-D])[.)]\s+(.+)$", txt, re.DOTALL)
        if m:
            let = m.group(1)
            if let not in questions_raw[current_qid]["options"]:
                questions_raw[current_qid]["options"][let] = {"id": let, "en": "", "vi": m.group(2).strip()}
            else:
                questions_raw[current_qid]["options"][let]["vi"] = m.group(2).strip()
                
    if current_qid and img_rids:
        for rid in img_rids:
            if rid in img_map:
                wp = img_map[rid]
                if wp not in questions_raw[current_qid]["images"]:
                    questions_raw[current_qid]["images"].append(wp)

# Pass 2 answers
for para in paras:
    if para.style.name == "Answer Entry":
        txt = para.text.strip()
        lines = [l.strip() for l in txt.split("\n") if l.strip()]
        qid = re.search(r"^[A-Z0-9]+", lines[0]).group(0)
        let_m = re.search(r"[—–-]\s*([A-D])\s*[—–-]", lines[0])
        if let_m and qid in questions_raw:
            questions_raw[qid]["correctOptionId"] = let_m.group(1)
            for l in lines[1:]:
                if l.lower().startswith("explanation:"):
                    questions_raw[qid]["explanation"]["en"] = l[len("Explanation:"):].strip()
                elif l.lower().startswith("giải thích:"):
                    questions_raw[qid]["explanation"]["vi"] = l[len("Giải thích:"):].strip()
                elif any(l.lower().startswith(p) for p in ["source / nguồn:", "source:", "nguồn:"]):
                    questions_raw[qid]["sourceText"] = l.split(":", 1)[1].strip()

# Convert options dict to sorted list
for q in questions_raw.values():
    q["options"] = [q["options"][k] for k in sorted(q["options"].keys())]

print(f"Total extracted sections: {len(sections)}")
print(f"Total extracted questions: {len(questions_raw)}")

total_img_refs = sum(len(q["images"]) for q in questions_raw.values())
used_images = set(img for q in questions_raw.values() for img in q["images"])
print(f"Total extracted images from docx: {len(img_map)}")
print(f"Total image references in questions: {total_img_refs}")
print(f"Total unique images used in questions: {len(used_images)}")

bad_opts = [qid for qid, q in questions_raw.items() if len(q["options"]) != 4]
bad_ans = [qid for qid, q in questions_raw.items() if not q["correctOptionId"]]
bad_stem = [qid for qid, q in questions_raw.items() if not q["stem"]["en"] or not q["stem"]["vi"]]
bad_exp = [qid for qid, q in questions_raw.items() if not q["explanation"]["en"] or not q["explanation"]["vi"]]

print(f"Questions with != 4 options: {len(bad_opts)}")
print(f"Questions missing correct answer: {len(bad_ans)}")
print(f"Questions missing stem EN/VI: {len(bad_stem)}")
print(f"Questions missing explanation EN/VI: {len(bad_exp)}")
