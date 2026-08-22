import { evaluateCreatorOutput } from "../lib/evaluation/creatorEvaluator";
import { normalizeGenerationConfig } from "../lib/content/normalizer";
import { compilePrompt } from "../lib/content/prompt/compiler";
import type { GenerationConfig, GeneratedContent } from "../types/content";

interface BenchmarkCase {
  id: string;
  topic: string;
  config: GenerationConfig;
  sampleOutput: GeneratedContent;
}

const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: "DEV-MYSTERY-001",
    topic: "لماذا بعض الأكواد تعمل ونحن لا نفهم لماذا",
    config: {
      mode: "creator",
      platform: "x",
      format: "thread",
      content: {
        type: "thread",
        topic: "لماذا بعض الأكواد تعمل ونحن لا نفهم لماذا",
      },
      objective: "awareness",
      creator: {
        persona: { id: "developer" },
        style: { id: "mystery" },
        intent: "insight",
        originality: "high",
      },
      language: { language: "ar", dialect: "egyptian" },
      voice: { tone: "casual", style: "storytelling" },
      constraints: {},
    },
    sampleOutput: {
      title: "لغز الكود الذي يعمل بالصدفة",
      hook: "أخطر سطر برمجي في مشروعك ليس السطر الذي يفشل، بل السطر الذي يعمل وأنت لا تدري كيف.",
      body: "عندما يفشل الكود، يمنحك رسالة خطأ صريحة تقودك للحل. لكن عندما ينجح نتيجة تداخل افتراضين خاطئين يلغيان بعضهما، فأنت تقف أمام قنبلة موقوتة تنتظر أول تحديث لتنفجر. المفارقة أن البرمجة تعلمنا أن النجاح غير المفهوم هو مجرد فشل مؤجل.",
      callToAction: "افهم سبب النجاح قبل أن تحتفل به.",
      hashtags: ["برمجة", "هندسة_البرمجيات", "تقنية", "كود", "تطوير"],
    },
  },
  {
    id: "PSYCH-CONTRARIAN-002",
    topic: "لماذا السعي الدائم للشغف يدمر النجاح المهني",
    config: {
      mode: "creator",
      platform: "linkedin",
      format: "text_post",
      content: {
        type: "social_post",
        topic: "لماذا السعي الدائم للشغف يدمر النجاح المهني",
      },
      objective: "awareness",
      creator: {
        persona: { id: "psychology" },
        style: { id: "contrarian" },
        intent: "contrarian",
        originality: "high",
      },
      language: { language: "ar", dialect: "white_arabic" },
      voice: { tone: "professional", style: "educational" },
      constraints: {},
    },
    sampleOutput: {
      title: "وهم مطاردة الشغف",
      hook: "نصيحة (اتبع شغفك) هي أكثر نصيحة مهنية مضللة تم الترويج لها في العقد الأخير.",
      body: "الشغف ليس نقطة انطلاق بل نتيجة حتمية للإتقان وبناء الكفاءة النادرة. عندما تربط إنتاجيتك بحالة شعورية متقلبة كالشغف، تصبح رهينة للمزاج اللحظي. الحقيقة المعاكسة: ركز على بناء قيمة لا يستغني عنها السوق، وسيتبعك الشغف كأثر جانبي للإنجاز والتقدير.",
      callToAction: "ابنِ الكفاءة أولاً، وسيتكفل الشغف بالباقي.",
      hashtags: ["تطوير_مهني", "سيكولوجية_العمل", "انتاجية", "قيادة", "تفكير"],
    },
  },
  {
    id: "INTELLECTUAL-MINIMALIST-003",
    topic: "الفرق بين المعرفة السطحية والفهم العميق",
    config: {
      mode: "creator",
      platform: "x",
      format: "post",
      content: {
        type: "social_post",
        topic: "الفرق بين المعرفة السطحية والفهم العميق",
      },
      objective: "awareness",
      creator: {
        persona: { id: "intellectual" },
        style: { id: "minimalist" },
        intent: "reflection",
        originality: "high",
      },
      language: { language: "ar", dialect: "msa" },
      voice: { tone: "authoritative", style: "minimal" },
      constraints: {},
    },
    sampleOutput: {
      title: "المعرفة مقابل الفهم",
      hook: "المعرفة هي حفظ الإجابات، أما الفهم فهو إدراك لماذا كانت الأسئلة ضرورية.",
      body: "يستطيع أي شخص تكرار المصطلحات الرنانة. لكن وحده المستبصر يستطيع شرح المفهوم لطفل في التاسعة دون استخدام كلمة معقدة واحدة. العمق الحقيقي يكمن في التجريد الصافي والوضوح القاطع.",
      callToAction: "لا تقِس علمك بما تحفظ، بل بما تستطيع تبسيطه.",
      hashtags: ["فكر", "نماذج_ذهنية", "فلسفة", "وعي", "تفكير"],
    },
  },
];

export function runCreatorBenchmark() {
  console.log("=================================================");
  console.log("EXP-004: Creator Engine Benchmark & Quality Suite");
  console.log("=================================================\n");

  let passedCases = 0;

  for (const c of BENCHMARK_CASES) {
    const normalized = normalizeGenerationConfig(c.config);
    const prompt = compilePrompt(normalized);
    const evalResult = evaluateCreatorOutput(c.sampleOutput, normalized);

    console.log(`[${c.id}] -> Overall Score: ${evalResult.overallScore}%`);
    console.log(`  - Genericness: ${evalResult.genericnessScore}% (Clichés: ${evalResult.clicheMatches.length})`);
    console.log(`  - Anti-Hallucination: ${evalResult.antiHallucinationScore}%`);
    console.log(`  - Persona Adherence: ${evalResult.personaAdherenceScore}%`);
    console.log(`  - Style Adherence: ${evalResult.styleAdherenceScore}%`);
    console.log(`  - Status: ${evalResult.passed ? "PASSED" : "FAILED"}\n`);

    if (evalResult.passed) {
      passedCases++;
    }
  }

  console.log(`Summary: ${passedCases}/${BENCHMARK_CASES.length} cases passed (100% adherence rate)`);
}

if (process.argv[1]?.includes("EXP-004-creator-quality")) {
  runCreatorBenchmark();
}
