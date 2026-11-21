#!/usr/bin/env python3
"""تصدير كل جداول قاعدة البيانات لملف Excel واحد (قراءة فقط).

الاستخدام:  SUPABASE_DB_URL=... python3 export_excel.py mosbah_2026-11-21_1115.xlsx

- الجداول الفاضية بتتخطى.
- بيانات الدخول الحساسة مش بتتصدّر: كلمات المرور والتوكنات والجلسات ومفاتيح الإشعارات.
- التواريخ بتتحول لتوقيت القاهرة.
"""
import datetime as dt
import decimal
import json
import os
import re
import sys
import uuid
from zoneinfo import ZoneInfo

import psycopg2
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell

CAIRO = ZoneInfo("Africa/Cairo")

# السكيمات اللي بتتصدّر، بالترتيب
SCHEMAS = ("public", "private", "storage")

# جداول مش بتتصدّر لأنها أسرار (مفاتيح/اشتراكات إشعارات)
SKIP_TABLES = {
    "private.push_config",
    "public.push_subscriptions",
}

# جدول المستخدمين من نظام الدخول: بنصدّره من غير الأعمدة الحساسة
AUTH_USERS = "auth.users"
SENSITIVE_COLUMN = re.compile(r"password|token|secret|hash|otp|nonce", re.I)

ILLEGAL_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
MAX_CELL = 32000


def convert(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, dt.datetime):
        if v.tzinfo is not None:
            v = v.astimezone(CAIRO).replace(tzinfo=None)
        return v
    if isinstance(v, (dt.date, dt.time, int, float)):
        return v
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (bytes, bytearray, memoryview)):
        return f"<binary {len(bytes(v))} bytes>"
    if isinstance(v, dt.timedelta):
        return str(v)
    return str(v)


def text_cell(ws, v):
    """نص آمن: يشيل الرموز الممنوعة ويمنع إن النص اللي بيبدأ بـ = يتحول لمعادلة."""
    v = ILLEGAL_XML.sub("", v)
    if len(v) > MAX_CELL:
        v = v[:MAX_CELL] + "…"
    c = WriteOnlyCell(ws, value=v)
    c.data_type = "s"
    return c


def sheet_name(schema, table, used):
    base = table if schema == "public" else f"{schema}_{table}"
    base = re.sub(r"[\[\]:*?/\\]", "_", base)[:31]
    name, i = base, 2
    while name.lower() in used:
        suffix = f"_{i}"
        name = base[: 31 - len(suffix)] + suffix
        i += 1
    used.add(name.lower())
    return name


def list_tables(cur):
    cur.execute(
        """
        select table_schema, table_name
        from information_schema.tables
        where table_type = 'BASE TABLE' and table_schema = any(%s)
        order by array_position(%s::text[], table_schema::text), table_name
        """,
        (list(SCHEMAS), list(SCHEMAS)),
    )
    tables = [(s, t) for s, t in cur.fetchall() if f"{s}.{t}" not in SKIP_TABLES]
    tables.append(("auth", "users"))
    return tables


def columns_of(cur, schema, table):
    cur.execute(
        """
        select column_name from information_schema.columns
        where table_schema = %s and table_name = %s
        order by ordinal_position
        """,
        (schema, table),
    )
    cols = [r[0] for r in cur.fetchall()]
    if f"{schema}.{table}" == AUTH_USERS:
        cols = [c for c in cols if not SENSITIVE_COLUMN.search(c)]
    return cols


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: export_excel.py OUTPUT.xlsx")
    out = sys.argv[1]
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("SUPABASE_DB_URL is not set")

    conn = psycopg2.connect(url)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    wb = Workbook(write_only=True)
    index_ws = wb.create_sheet("الفهرس")
    index_ws.sheet_view.rightToLeft = True
    index_ws.append(["الجدول", "الصفحة", "عدد الصفوف"])

    used = {"الفهرس"}
    index_rows = []
    exported = 0

    for schema, table in list_tables(cur):
        cols = columns_of(cur, schema, table)
        if not cols:
            continue
        col_sql = ", ".join(f'"{c}"' for c in cols)
        data = conn.cursor(name=f"c_{exported}")
        data.itersize = 2000
        data.execute(f'select {col_sql} from "{schema}"."{table}"')
        first = data.fetchmany(1)
        if not first:
            data.close()
            continue

        name = sheet_name(schema, table, used)
        ws = wb.create_sheet(name)
        ws.sheet_view.rightToLeft = True
        ws.freeze_panes = "A2"
        ws.append(cols)
        count = 0
        batch = first
        while batch:
            for row in batch:
                out_row = []
                for v in row:
                    v = convert(v)
                    out_row.append(text_cell(ws, v) if isinstance(v, str) else v)
                ws.append(out_row)
                count += 1
            batch = data.fetchmany(2000)
        data.close()
        index_rows.append([f"{schema}.{table}", name, count])
        exported += 1

    for r in index_rows:
        index_ws.append(r)
    index_ws.append([])
    index_ws.append(["تم الاستبعاد عمداً: كلمات المرور والتوكنات والجلسات ومفاتيح الإشعارات"])

    wb.save(out)
    conn.close()
    print(f"sheets: {exported}, rows: {sum(r[2] for r in index_rows)}, file: {out}")


if __name__ == "__main__":
    main()
