import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { evaluateReasoningSeparation } from "../lib/evaluation/reasoningSeparationEvaluator";
import type { PersonaId } from "../lib/evaluation/types";

// ─── Gate 2: Evaluator Sanity Check ──────────────────────────────────────────
// We construct 4 SYNTHETIC texts on the SAME topic ("procrastination").
// Each text embeds an UNMISTAKABLY different causal model.
// If the evaluator gives them separation < 70, it's blind to causal structure.
// If it gives them > 80, it's working — and the generation is the problem.

const TEXTS: Record<PersonaId, string> = {
  developer: `
التسويف: مشكلة هندسية، لا إرادية.

المشكلة: input (مهمة صعبة) → bottleneck (غياب تفكيك واضح) → throughput صفر.
الجذر: النظام لا يعالج المهمة، بل يعيد جدولتها لأن المدخل لم يُفكَّك.
التدخل: اكسر المهمة إلى وحدات بحجم batch قابل للتنفيذ.
المخرج القابل للقياس: وقت اتخاذ القرار الأول ينخفض عندما تصبح أول خطوة واضحة تماماً.
الاستنتاج: التسويف هو bug في واجهة الإدخال، لا في الدوافع.
  `.trim(),

  psychology: `
التسويف: استجابة دفاعية مُعزَّزة.

الدافع: تجنب مشاعر الفشل المتوقع، لا الكسل.
التهديد المُدرَك: المهمة الصعبة = تهديد للكفاءة الذاتية.
النمط السلوكي: التأجيل يُزيل التهديد مؤقتاً → تعزيز فوري (ارتياح).
آلية البقاء: كلما تكرر التعزيز، كلما ترسّخ التجنب كاستجابة افتراضية.
التحول المطلوب: إعادة تفسير المهمة كتحدٍّ للنمو، لا كاختبار للقيمة الذاتية.
الاستنتاج: من لا يُدرك الدافع الحقيقي، يعالج الأعراض ولا يصل إلى التغيير.
  `.trim(),

  intellectual: `
التسويف: نقيض الإرادة، أم برهانها؟

الافتراض الشائع: التسويف = ضعف إرادة.
نقيضه: الإرادة تعمل كل الوقت — لكنها تختار التجنب بدل الإنجاز.
التوتر: إذا كان كل سلوك اختياراً، فلماذا نلوم الإرادة؟
المفارقة: الإنسان الذي يُسوّف "يُفكر كثيراً" — وهذا التفكير هو فعل إرادي.
إعادة الصياغة: التسويف ليس غياب الإرادة، بل إرادة موجهة نحو الخيار الأقل مقاومة.
التوليف: الحل ليس تقوية الإرادة، بل إعادة هيكلة المشهد حتى يكون الإنجاز هو الاختيار الأقل مقاومة.
  `.trim(),

  creative: `
التسويف: كعب الأخيل في متاهة الخيول.

تخيّل حصانًا يقف أمام حاجز. لا يرفض القفز — يُصوّر كيف سيسقط.
الصورة هذه هي التسويف: الذهن يُعيش المستقبل قبل حدوثه، فيرى الخسارة مسبقاً.
المفارقة الجميلة: أكثر الناس تسويفاً هم أكثرهم خيالاً.
لحظة التحول: حين تُدرك أن الصورة في رأسك ليست المستقبل — بل مجرد صورة.
الخاتمة: الحصان لا يقفز حين يكف عن التصوير. يقفز حين ينظر إلى الحاجز مباشرة، لا إلى النسخة في خياله.
  `.trim(),
};

const PAIRS: [PersonaId, PersonaId][] = [
  ["developer", "psychology"],
  ["developer", "intellectual"],
  ["developer", "creative"],
  ["psychology", "intellectual"],
  ["psychology", "creative"],
  ["intellectual", "creative"],
];

async function runSanityCheck() {
  console.log("🔬 Gate 2: Evaluator Sanity Check — Synthetic Causal Models\n");
  console.log("Topic: التسويف (same topic for all 4 personas)\n");

  let totalScore = 0;
  let failed = 0;

  for (const [pA, pB] of PAIRS) {
    try {
      const result = await evaluateReasoningSeparation(TEXTS[pA], pA, TEXTS[pB], pB);
      const passed = result.separation_score >= 75;
      if (!passed) failed++;
      totalScore += result.separation_score;
      console.log(`${pA} vs ${pB}:`);
      console.log(`  separation_score     = ${result.separation_score} ${passed ? "✅" : "❌"}`);
      console.log(`  is_vocabulary_only   = ${result.is_vocabulary_only_swap}`);
      console.log(`  worldview_difference = ${result.worldview_difference.slice(0, 120)}...`);
      console.log(`  causal_difference    = ${result.causal_model_difference.slice(0, 120)}...`);
      console.log();
    } catch (e: any) {
      console.error(`Error on ${pA} vs ${pB}:`, e?.message);
    }
  }

  const avg = Math.round(totalScore / PAIRS.length);
  console.log("─".repeat(60));
  console.log(`Average Separation: ${avg}`);
  console.log(`Pairs Failed (< 75): ${failed}/${PAIRS.length}`);
  console.log();

  if (avg >= 80 && failed === 0) {
    console.log("✅ EVALUATOR VERDICT: Evaluator is working correctly.");
    console.log("   → The problem is in GENERATION. Causal models are not being followed.");
  } else if (avg >= 60) {
    console.log("⚠️  EVALUATOR VERDICT: Evaluator is partially calibrated.");
    console.log("   → Some signals are detected but not reliably. Needs tuning.");
  } else {
    console.log("❌ EVALUATOR VERDICT: Evaluator is blind to causal structure.");
    console.log("   → Do NOT trust ablation causal scores. Fix evaluator before EXP-006.");
  }
}

runSanityCheck().catch(console.error);

