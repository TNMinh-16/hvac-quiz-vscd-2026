#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from pathlib import Path
from docx import Document

DOCX_PATH = Path(__file__).resolve().parent.parent / "HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx"
doc = Document(str(DOCX_PATH))

paras = doc.paragraphs

# Tìm đoạn Answer Header đầu tiên và in context
print("=== ANSWER SECTION context (paragraphs 2301-2380) ===")
for i, para in enumerate(paras):
    if 2300 <= i <= 2380:
        style = para.style.name
        txt = para.text.strip()
        if txt or style != "Normal":
            print(f"[{i:04d}] [{style}] {repr(txt[:300])}")

print("\n=== Answer block for Q001-Q003 context ===")
for i, para in enumerate(paras):
    if 2304 <= i <= 2340:
        style = para.style.name
        txt = para.text.strip()
        print(f"[{i:04d}] [{style}] {repr(txt[:400])}")
