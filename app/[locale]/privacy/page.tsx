import { useLocale } from "next-intl";

export default function PrivacyPage() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: "var(--container-sm)", margin: "0 auto", padding: "var(--space-12) var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-8)" }}>
        {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
      </h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-loose)" }}>
        <p>
          {isAr 
            ? "خصوصيتك أولوية قصوى بالنسبة لنا. تشرح هذه السياسة كيفية جمعنا واستخدامنا وحمايتنا لبياناتك عند استخدامك لمنصة سَوِّق."
            : "Your privacy is our top priority. This policy explains how we collect, use, and protect your data when you use the Sawwiq platform."}
        </p>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "البيانات المجمعة" : "Data We Collect"}
          </h2>
          <p>
            {isAr 
              ? "نجمع فقط البيانات الضرورية لتشغيل حسابك، وتشمل: البريد الإلكتروني، معرف الحساب (User ID)، وسجل التوليد الخاص بك للسماح لك بالرجوع لنصوصك السابقة."
              : "We only collect data necessary to operate your account, including: email address, User ID, and your generation history to allow you to retrieve previous content."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "استخدام البيانات وحمايتها" : "Data Usage and Protection"}
          </h2>
          <p>
            {isAr 
              ? "تُستخدم بياناتك وسجل المحتوى الخاص بك حصرياً لتقديم الخدمة لك وتحسين تجربتك. نؤكد لك أننا لا نقوم ببيع أو مشاركة بياناتك الشخصية أو نصوصك المولدة مع أي أطراف ثالثة لأغراض إعلانية."
              : "Your data and generation history are used exclusively to provide the service and improve your experience. We guarantee that we do not sell or share your personal data or generated copy with any third parties for advertising purposes."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "بيانات الدفع" : "Payment Information"}
          </h2>
          <p>
            {isAr 
              ? "لا نقوم بتخزين أو معالجة أي بيانات خاصة بالبطاقات الائتمانية على خوادمنا. تتم معالجة جميع المدفوعات بشكل آمن تماماً عبر شريك الدفع المعتمد لدينا (Tap Payments)."
              : "We do not store or process any credit card data on our servers. All payments are processed securely through our authorized payment partner (Tap Payments)."}
          </p>
        </section>
      </div>
    </div>
  );
}
