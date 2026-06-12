// Karochat — Ask-a-Doctor "this is not medical care" banner (v9 Phase 4).
//
// Structural non-negotiable: rendered non-dismissably on every /doctor
// surface. No close button, no localStorage opt-out — by design.

export function DoctorBanner() {
  return (
    <section className="surface-glass tint-amber p-4">
      <p className="text-[10px] uppercase tracking-widest text-neon-amber/80">
        ⚕️ This is not medical care
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/80">
        Karochat doctors are independently verified clinicians offering{" "}
        <strong className="text-white">general guidance only</strong> — not a
        diagnosis, not a prescription, and never a substitute for seeing a
        doctor in person. In an emergency, stop and call your local emergency
        number (<strong className="text-white">112 / 108</strong> in India,{" "}
        <strong className="text-white">911</strong> US,{" "}
        <strong className="text-white">999</strong> UK).
      </p>
    </section>
  );
}
