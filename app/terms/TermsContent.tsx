// Karochat — full Terms & Conditions shown inline on the first-login gate.
// Plain presentational component. Keep in sync with /legal/terms.

export function TermsContent() {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/80">
      <p className="text-[11px] uppercase tracking-widest text-white/45">
        Karochat — Terms &amp; Conditions · v1
      </p>

      <h3 className="mt-3 font-display text-base font-semibold text-white">1. Who can use Karochat</h3>
      <p>
        You must be at least 13 years old to use Karochat, and at least 18 to
        view or take part in adult (18+) content and rooms. By continuing you
        confirm you meet these ages and are legally able to agree to these
        Terms in your country. If you are between 13 and 17, adult surfaces are
        not available to you and you must not attempt to access them.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">2. Be kind. Be real.</h3>
      <p>
        Karochat is for people — all of them. Adults can talk like adults here.
        We don&apos;t moderate vibes, run word filters on ordinary
        conversation, or police who you love or what you want. In return we ask
        you to treat others with respect, honour consent, and not be cruel for
        sport. If something here isn&apos;t for you, scroll past it or block the
        person — both are easy.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-neon-red">
        3. The four hard lines (zero tolerance)
      </h3>
      <p>There are four things we will never allow, ever:</p>
      <ul className="ml-4 list-disc space-y-1">
        <li>
          <strong className="text-white">Nothing involving minors.</strong> Any
          sexual content, contact, or grooming involving anyone under 18.
        </li>
        <li>
          <strong className="text-white">No non-consensual intimate images,</strong>{" "}
          including deepfakes of real people.
        </li>
        <li>
          <strong className="text-white">No terrorism, no calls for violence,
          no organised hate.</strong> Disagree all you want; do not organise or
          glorify harm.
        </li>
        <li>
          <strong className="text-white">No doxxing</strong> — exposing
          someone&apos;s real identity, address, workplace or face without
          their consent.
        </li>
      </ul>
      <p className="mt-2 rounded-lg border border-neon-red/40 bg-neon-red/[0.08] p-3 text-white/90">
        <strong className="text-neon-red">Enforcement.</strong> Crossing these
        lines — especially anything involving a minor or terrorism — results in
        immediate, permanent removal. We log and retain your IP address,
        device, and account details, blacklist you, and report you and that
        information to the relevant law-enforcement authorities. There is no
        anonymity and no second chance for this. Flagged words and messages in
        these categories are recorded for review.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">4. Your account &amp; access</h3>
      <p>
        Sign-in uses your email and phone number for instant access. You are
        responsible for activity under your account. We may suspend or remove
        accounts that break these Terms. Guests can browse the Lobby only; full
        access requires your email and phone.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">5. Your content</h3>
      <p>
        You keep ownership of what you post. You grant Karochat the limited
        right to host, store, and display your content to the people in your
        rooms so the Service works. You are responsible for what you share and
        must have the right to share it. Don&apos;t post anything illegal.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">6. Privacy</h3>
      <p>
        We collect only what we need to run the Service and we don&apos;t sell
        your data. Messages in public rooms are visible to room members;
        messages in private rooms are visible only to people you&apos;ve
        invited. For safety and legal compliance we may log technical data
        (including IP addresses) and disclose it to authorities where the law
        requires or where the hard lines above are crossed. See the Privacy
        Notice for details.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">7. No warranty &amp; limits</h3>
      <p>
        Karochat is provided free, &quot;as is&quot;, without warranties of any
        kind. We don&apos;t guarantee it will always be available, secure, or
        error-free. To the maximum extent permitted by law, Karochat is not
        liable for indirect or consequential damages arising from your use of
        the Service. Educational content (including sex education) is
        information, not professional medical, legal, or safety advice.
      </p>

      <h3 className="mt-4 font-display text-base font-semibold text-white">8. Changes &amp; governing law</h3>
      <p>
        We may update these Terms; continued use after an update means you
        accept the new version. These Terms are governed by the laws of India,
        without prejudice to mandatory consumer protections in your country of
        residence.
      </p>

      <p className="mt-4 text-[12px] text-white/50">
        Full documents:{" "}
        <a href="/legal/terms" target="_blank" className="text-neon-blue underline">Terms of Use</a>,{" "}
        <a href="/legal/community" target="_blank" className="text-neon-blue underline">Community Guidelines</a>,{" "}
        <a href="/legal/privacy" target="_blank" className="text-neon-blue underline">Privacy Notice</a>.
      </p>
    </div>
  );
}
