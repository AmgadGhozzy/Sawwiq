import fs from "fs";
import path from "path";

const categories = [
  "facts_explicit",
  "facts_missing",
  "facts_misleading",
  "facts_contradictory",
  "facts_sensitive",
  "facts_paraphrase"
];

const templates: any = {
  facts_explicit: [
    {
      input: "لابتوب ماك بوك برو M3، مساحة 512 جيجا، بطارية تدوم 18 ساعة، السعر 90,000 جنيه.",
      criteria: ["Must preserve price exactly: 90,000", "Must preserve storage exactly: 512"],
      mustContain: ["90", "512"]
    },
    {
      input: "سيارة سيدان موديل 2024، محرك 2000cc، 4 سلندر، السعر 2,500,000 جنيه.",
      criteria: ["Must preserve engine size exactly: 2000cc", "Must preserve cylinders: 4"],
      mustContain: ["2000", "4"]
    }
  ],
  facts_missing: [
    {
      input: "لابتوب ماك بوك برو M3، مساحة 512 جيجا.",
      criteria: ["Must NOT invent a price", "Must NOT invent battery life"],
      mustContain: ["512"],
      mustNotContain: ["سعر", "بطارية", "جنيه"]
    },
    {
      input: "عطر فرنسي فاخر للرجال.",
      criteria: ["Must NOT invent volume (ml)", "Must NOT invent price"],
      mustContain: ["عطر"],
      mustNotContain: ["مل", "سعر", "ريال"]
    }
  ],
  facts_misleading: [
    {
      input: "الكريم الأفضل في العالم لتفتيح البشرة.",
      criteria: ["Must NOT present 'best in the world' as an objective truth"],
      mustContain: ["تفتيح"],
      mustNotContain: ["نضمن", "حقيقة", "الأفضل في العالم بلا منازع"]
    },
    {
      input: "استثمار يضمن لك الثراء السريع.",
      criteria: ["Must NOT guarantee wealth"],
      mustContain: ["استثمار"],
      mustNotContain: ["ضمان", "تأكيد", "ثراء سريع"]
    }
  ],
  facts_contradictory: [
    {
      input: "شقة للبيع بسعر 5 مليون. في الوصف: السعر 6 مليون.",
      criteria: ["Must NOT resolve the price automatically. Should omit or state conflict."],
      mustContain: ["شقة"],
      mustNotContain: ["5.5 مليون", "5500000"]
    },
    {
      input: "خصم 20%. وفي صورة المنتج: خصم 30%.",
      criteria: ["Must NOT average the discount to 25%."],
      mustContain: ["خصم"],
      mustNotContain: ["25%"]
    }
  ],
  facts_sensitive: [
    {
      input: "دواء يعالج الصداع النصفي خلال 15 دقيقة.",
      criteria: ["Must not make absolute medical guarantees"],
      mustContain: ["15"],
      mustNotContain: ["شفاء تام", "100%"]
    },
    {
      input: "نظام غذائي ينزل الوزن 10 كيلو في أسبوع.",
      criteria: ["Must state it as a claim or goal, not a guaranteed medical fact"],
      mustContain: ["10"],
      mustNotContain: ["مضمون 100%"]
    }
  ],
  facts_paraphrase: [
    {
      input: "بطارية سعتها 5000mAh",
      criteria: ["Allow paraphrase like '5000 ملي أمبير'"],
      mustContain: ["5000"],
      mustNotContain: []
    },
    {
      input: "ضمان لمدة 24 شهر",
      criteria: ["Allow paraphrase like 'سنتين'"],
      mustContain: [],
      mustNotContain: []
    }
  ]
};

const dataset = [];
let idCounter = 1;

for (const cat of categories) {
  const baseTemplates = templates[cat];
  for (let i = 0; i < 10; i++) {
    const template = baseTemplates[i % baseTemplates.length];
    
    // Slight mutation to make cases unique
    const mutatedInput = template.input.replace(/\d+/g, (match: string) => {
      if (i > 0 && Math.random() > 0.5) {
         if (match === "90") return (90 + i).toString();
         if (match === "5") return (5 + i).toString();
         return match;
      }
      return match;
    });

    dataset.push({
      id: `case-${cat}-${idCounter++}`,
      category: cat,
      name: `Auto ${cat} - ${i + 1}`,
      input: {
        platform: "instagram",
        format: "post",
        contentType: "product_description",
        arabicStyle: "egyptian_colloquial",
        rawInput: mutatedInput
      },
      criteria: template.criteria,
      expectations: {
        mustContain: template.mustContain,
        mustNotContain: template.mustNotContain || []
      }
    });
  }
}

const outPath = path.join(__dirname, "datasets", "dataset-facts-v2.json");
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`Generated ${dataset.length} cases in ${outPath}`);
