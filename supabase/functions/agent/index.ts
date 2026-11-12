// The "brain" of the assistant: one Gemini step per call. The app runs the tools (with the user's own permissions)
// and sends the results back, so the model never touches the database itself.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const S = (description: string) => ({ type: "STRING", description });
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  name,
  description,
  ...(Object.keys(properties).length ? { parameters: { type: "OBJECT", properties, required } } : {}),
});

const declarations = [
  tool("list_projects", "كل المشاريع مع id والحالة والوارد والمصروف والميزانية."),
  tool("list_contractors", "كل المقاولين مع id والمستحق والمدفوع والباقي."),
  tool("list_banks", "كل البنوك مع id والرصيد."),
  tool("list_advances", "كل العهد مع id واسم صاحب العهدة والمستلم والمصروف والباقي."),
  tool("list_categories", "البنود (التصنيفات) المتاحة وتحت كل بند أسماء البيان."),
  tool(
    "contractor_account",
    "حساب مقاول: مستحقات ومدفوعات والباقي وما صُرف باسمه. اختياري تحديد مشروع.",
    { contractor_id: S("id المقاول"), project_id: S("id المشروع (اختياري)") },
    ["contractor_id"],
  ),
  tool(
    "search_entries",
    "بحث في القيود برقم القيد أو المبلغ أو البند أو البيان أو اسم المشروع أو المقاول.",
    { query: S("كلمة البحث") },
    ["query"],
  ),
  tool("pending_entries", "القيود المستنية الموافقة (اختياري لمشروع معين).", { project_id: S("id المشروع (اختياري)") }),
  tool(
    "open_page",
    "يفتح صفحة في التطبيق. المسارات: dashboard, projects, projects/<id>, projects/<id>/report, advances, advances/<id>, banks, banks/<id>, contractors, contractors/<id>, approvals, reports, recent, search, notifications, users, backup, quick-entry",
    { path: S("المسار") },
    ["path"],
  ),
  tool(
    "create_entry",
    "يسجّل قيد جديد (بيستنى الموافقة). المصروف لازم له بند category وبيان item وبنك bank (أو advance_id لو من عهدة). الوارد لازم له وصف item وبنك. يطلب تأكيد المستخدم قبل التنفيذ.",
    {
      project_id: S("id المشروع"),
      kind: { type: "STRING", enum: ["income", "expense"] },
      amount: { type: "NUMBER", description: "المبلغ بالجنيه" },
      category: S("اسم البند بالظبط من list_categories (للمصروف)"),
      item: S("البيان / وصف القيد"),
      bank: S("اسم البنك بالظبط من list_banks (لو مش من عهدة)"),
      advance_id: S("id العهدة لو مدفوع من عهدة"),
      contractor: S("اسم المقاول (اختياري)"),
      date: S("التاريخ YYYY-MM-DD (الافتراضي النهاردة)"),
      notes: S("ملاحظات (اختياري)"),
    },
    ["project_id", "kind", "amount", "item"],
  ),
  tool(
    "approve_entries",
    "يوافق على قيود مستنية. للأدمن بس. يطلب تأكيد المستخدم.",
    { entry_ids: { type: "ARRAY", items: { type: "STRING" }, description: "ids القيود من pending_entries" } },
    ["entry_ids"],
  ),
];

const system = (today: string, context: string) => `انت مساعد محاسب في تطبيق "المصباح" لإدارة مشاريع مقاولات وتشطيبات في مصر. بتتكلم بالعامية المصرية، قصير ومباشر.
النهاردة ${today}. العملة جنيه مصري.
- استخدم الأدوات دايمًا عشان تجيب الأرقام والـids. ما تخترعش رقم ولا id.
- لو المستخدم ذكر مشروع أو مقاول أو بنك بالاسم، دوّر عليه في القوائم (حتى لو الاسم ناقص أو مكتوب بشكل تاني).
- قبل ما تسجّل قيد لازم تكون عارف: المشروع، النوع، المبلغ، البيان، والبنك (أو العهدة). لو ناقص حاجة اسأل سؤال واحد قصير. لو المبلغ "٣٠ ألف" يبقى 30000.
- أدوات التسجيل والموافقة بتطلب تأكيد من المستخدم لوحدها، ما تسألش تأكيد في الكلام.
- بعد التنفيذ قول النتيجة في جملة قصيرة. لو الأداة رجّعت خطأ اشرحه وقول يعمل إيه.
- لو الطلب خارج قدرات الأدوات قول ده بصراحة.
- ابدأ بالقوائم الجاهزة تحت (id | اسم) ومتنادّيش list_* غير لو محتاج الأرقام. نادّي كذا أداة مع بعض في نفس الخطوة لو تقدر.
${context}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "no key" }, 500);
  let body: { contents?: unknown[]; today?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const contents = body.contents ?? [];
  if (!Array.isArray(contents) || contents.length === 0 || JSON.stringify(contents).length > 120_000)
    return json({ error: "bad contents" }, 400);

  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system(String(body.today ?? ""), String(body.context ?? "").slice(0, 20000)) }] },
          contents,
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { temperature: 0.2 },
        }),
      });
      if (!r.ok) {
        errors.push(`${model} ${r.status} ${(await r.text()).replace(/\s+/g, " ").slice(0, 160)}`);
        continue;
      }
      const data = await r.json();
      const parts = data.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        errors.push(`${model} empty`);
        continue;
      }
      return json({ parts, model });
    } catch (e) {
      errors.push(`${model} ${String(e).slice(0, 100)}`);
    }
  }
  return json({ error: "ai", detail: errors }, 502);
});
