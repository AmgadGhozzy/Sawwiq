import { useLocale } from "next-intl";

export default function RefundPage() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: "var(--container-sm)", margin: "0 auto", padding: "var(--space-12) var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-8)" }}>
        {isAr ? "سياسة الاسترجاع" : "Refund Policy"}
      </h1>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--color-foreground-secondary)", lineHeight: "var(--leading-loose)" }}>
        <p>
          {isAr 
            ? "نحن في سَوِّق نلتزم بتقديم تجربة شفافة وعادلة لجميع مستخدمينا. تم إعداد سياسة الاسترجاع هذه لتوضيح حقوقك المتعلقة بالأرصدة (الكريدت) المشتراة."
            : "At Sawwiq, we are committed to providing a transparent and fair experience for all our users. This refund policy outlines your rights regarding purchased credits."}
        </p>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "الأرصدة المستهلكة" : "Consumed Credits"}
          </h2>
          <p>
            {isAr 
              ? "الأرصدة التي تم استهلاكها بالفعل في توليد المحتوى غير قابلة للاسترجاع تحت أي ظرف، حيث تم تقديم الخدمة واستهلاك موارد الذكاء الاصطناعي."
              : "Credits that have already been consumed to generate content are strictly non-refundable under any circumstances, as the service and AI resources have already been utilized."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "الأرصدة غير المستخدمة" : "Unused Credits"}
          </h2>
          <p>
            {isAr 
              ? "يمكن للمستخدم طلب استرجاع قيمة حزم الأرصدة غير المستخدمة بالكامل خلال 14 يوماً من تاريخ الشراء. إذا تم استخدام جزء من الحزمة، لا يمكن استرجاع القيمة المتبقية."
              : "Users may request a full refund for entirely unused credit packages within 14 days of the purchase date. If any portion of the package has been used, the remaining balance is non-refundable."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", marginBottom: "var(--space-2)" }}>
            {isAr ? "آلية طلب الاسترجاع" : "How to Request a Refund"}
          </h2>
          <p>
            {isAr 
              ? "لتقديم طلب استرجاع، يرجى التواصل معنا عبر البريد الإلكتروني refunds@sawwiq.com مع إرفاق رقم العملية (Charge ID) والبريد الإلكتروني المسجل. سيتم معالجة الطلبات خلال 5-7 أيام عمل وإعادتها إلى نفس طريقة الدفع الأصلية."
              : "To submit a refund request, please contact us at refunds@sawwiq.com with your Charge ID and registered email address. Requests will be processed within 5-7 business days and refunded to the original payment method."}
          </p>
        </section>
      </div>
    </div>
  );
}
