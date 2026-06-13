// Karochat — shared health/wellbeing disclaimer banner.
//
// Used on the Ayurveda and Diet & Recipes pages. Pure markup, no client JS.

export function HealthDisclaimer() {
  return (
    <div className="surface-glass border-neon-amber/30 bg-neon-amber/5 p-4">
      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-white/80">
        <span aria-hidden className="mt-0.5 text-lg">⚠️</span>
        <span>
          <strong className="text-neon-amber">For general information only.</strong>{" "}
          This is not medical advice, a diagnosis, or a treatment plan. Always{" "}
          <strong className="text-white">consult a qualified doctor</strong> or
          registered practitioner before trying any remedy, herb, diet or detox —
          especially if you are pregnant, nursing, on medication, or managing a
          health condition. Combine anything here with{" "}
          <strong className="text-white">regular exercise</strong> and a balanced
          lifestyle, and seek medical help if symptoms persist or worsen.
        </span>
      </p>
    </div>
  );
}
