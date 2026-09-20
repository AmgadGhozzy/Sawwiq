import { useLocale } from "next-intl";

export default function TermsPage() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: "var(--container-sm)", margin: "0 auto", padding: "var(--space-12) var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-8)" }}>
        {isAr ? "الشروط والأحكام" : "Terms and Conditions"}
      </h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-loose)" }}>
        <p>
          {isAr 
            ? "مرحباً بك في سَوِّق. باستخدامك لخدماتنا، فإنك توافق على الالتزام بالشروط والأحكام التالية."
            : "Welcome to Sawwiq. By using our services, you agree to be bound by the following terms and conditions."}
        </p>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "طبيعة الخدمة" : "Nature of Service"}
          </h2>
          <p>
            {isAr 
              ? "سَوِّق هي أداة مدعومة بالذكاء الاصطناعي تهدف إلى مساعدة صناع المحتوى والمسوقين في كتابة نصوص تسويقية وإعلانية بلهجات عربية متعددة. الخدمة مقدمة \"كما هي\" وقد تختلف دقة النتائج بناءً على المدخلات المقدمة."
              : "Sawwiq is an AI-powered tool designed to assist content creators and marketers in writing marketing and advertising copy in multiple Arabic dialects. The service is provided \"as is\" and output accuracy may vary based on user input."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "الملكية الفكرية" : "Intellectual Property"}
          </h2>
          <p>
            {isAr 
              ? "المحتوى المُولّد باستخدام سَوِّق هو ملك للمستخدم بالكامل. يمنحك سَوِّق ترخيصاً تجارياً مفتوحاً لاستخدام وتعديل ونشر النصوص المولدة في حملاتك التسويقية دون الحاجة للإشارة إلينا."
              : "Content generated using Sawwiq is fully owned by the user. Sawwiq grants you a broad commercial license to use, modify, and publish the generated copy in your marketing campaigns without any attribution requirement."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "الاستخدام المحظور" : "Prohibited Use"}
          </h2>
          <p>
            {isAr 
              ? "يُمنع منعاً باتاً استخدام الأداة لتوليد محتوى مسيء، تشهيري، سياسي غير قانوني، أو احتيالي يهدف إلى تضليل المستهلكين. نحتفظ بالحق في تعليق أو حظر الحسابات التي تنتهك سياسات المحتوى الآمن الخاصة بنا فوراً ودون إنذار مسبق."
              : "It is strictly prohibited to use the tool to generate offensive, defamatory, illegal political content, or fraudulent copy intended to mislead consumers. We reserve the right to suspend or ban accounts that violate our safe content policies immediately and without prior notice."}
          </p>
        </section>
      </div>
    </div>
  );
}
