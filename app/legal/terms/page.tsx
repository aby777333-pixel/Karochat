export const metadata = { title: "Terms of Use — Karochat" };

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Terms of Use</h1>
      <p className="text-sm text-white/40">
        Version 1 · Last updated {new Date().toISOString().slice(0, 10)}
      </p>

      <p>
        Karochat is a free, realtime messaging platform. By creating an account
        (including signing in as a guest) or otherwise using Karochat
        (&ldquo;the Service&rdquo;), you agree to these Terms of Use. If you do
        not agree, please do not use the Service.
      </p>

      <h2>1. Who can use Karochat</h2>
      <p>
        You must be old enough to lawfully agree to these terms in your
        jurisdiction. In most places that means 13 or older; in the European
        Economic Area, the United Kingdom, and similar regions, that minimum is
        16. If a parent or legal guardian must consent on your behalf, please
        do not use the Service without that consent. We reserve the right to
        suspend accounts that we reasonably believe to be operated by
        individuals below the applicable minimum age.
      </p>

      <h2>2. Free to use</h2>
      <p>
        The Service is provided free of charge. We may introduce optional paid
        features in the future, but they will never be required for ordinary
        use of public or private rooms.
      </p>

      <h2>3. Your account</h2>
      <p>
        You may use Karochat with an email address (via magic link) or as an
        anonymous guest. You are responsible for activity that occurs under
        your session. If you believe your account has been used without your
        permission, sign out from all devices and contact us.
      </p>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of the text, images, and other material you post
        (&ldquo;Your Content&rdquo;). By posting Your Content, you grant
        Karochat a worldwide, non-exclusive, royalty-free licence to host,
        transmit, display, and back it up for the purpose of operating the
        Service. You can delete Your Content from the Service at any time; some
        copies may remain in backups for a limited period.
      </p>

      <h2>5. What you must not do</h2>
      <ul>
        <li>Post content that is illegal where it is posted or where it is read.</li>
        <li>Post content that sexually depicts minors or that exploits, abuses, or endangers a child in any way.</li>
        <li>
          Post content that incites violence against, threatens, or targets
          another person on the basis of their race, ethnicity, national
          origin, caste, religion, disability, gender, gender identity, sexual
          orientation, immigration status, or serious disease.
        </li>
        <li>Post non-consensual intimate imagery, doxxing, or stalking content.</li>
        <li>Send malware, spam, scams, or unauthorised advertising.</li>
        <li>Attempt to access another user&rsquo;s account or data, or to disrupt the Service.</li>
        <li>Use the Service to impersonate another real person in a way that misleads or harms them.</li>
      </ul>

      <h2>6. Moderation</h2>
      <p>
        We rely primarily on community reporting. We may remove content or
        suspend accounts that violate these terms or the{" "}
        <a href="/legal/community">Community Guidelines</a>. We aim to act
        proportionately. Severe violations (such as content covered by section
        5) will result in immediate removal.
      </p>

      <h2>7. Service availability</h2>
      <p>
        Karochat is provided &ldquo;as is&rdquo; without warranty of any kind.
        We will make reasonable efforts to keep the Service running, but we do
        not guarantee uptime or that the Service will be free of bugs.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Karochat, its
        operators, contributors, and partners are not liable for indirect,
        incidental, special, consequential, or exemplary damages arising from
        your use of the Service, including loss of data, loss of profits, or
        loss of goodwill. Nothing in these terms limits liability that cannot
        lawfully be limited.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. When we make material
        changes, we will ask you to accept the new version before continuing
        to use the Service. The current version number is shown at the top of
        this page.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or concerns? Reach out to the team operating Karochat (GHL
        India Ventures) at the email address listed on the project README.
      </p>

      <hr className="my-8 border-white/10" />
      <p className="text-xs text-white/40">
        This is plain-language boilerplate provided as a starting point and is
        not legal advice. Before launching publicly, please have these terms
        reviewed by qualified counsel in the jurisdictions where Karochat
        operates.
      </p>
    </>
  );
}
