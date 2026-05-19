export const metadata = { title: "Privacy Notice — Karochat" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Privacy Notice</h1>
      <p className="text-sm text-white/40">Version 1</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data.</strong> If you sign in with email, we store
          your email address to send you magic links. If you sign in as a
          guest, we generate a random identifier; we do not collect an email
          for guest sessions.
        </li>
        <li>
          <strong>Profile data.</strong> The username, display name, and
          avatar URL you choose. For guests these are auto-generated.
        </li>
        <li>
          <strong>Messages.</strong> The text and image content you send,
          together with the room and timestamp.
        </li>
        <li>
          <strong>Connection data.</strong> When you are online, we maintain
          a transient presence record so other members can see who&rsquo;s in
          the room. This is not persistent.
        </li>
        <li>
          <strong>Operational logs.</strong> Standard server logs (IP address,
          user agent) for security and abuse prevention, retained for a short
          window.
        </li>
      </ul>

      <h2>What we do with it</h2>
      <p>
        We use this data to operate the Service: deliver your messages, keep
        you signed in, show you the right rooms, and protect everyone from
        abuse. We do not sell your data. We do not run third-party advertising
        on your messages.
      </p>

      <h2>Where it lives</h2>
      <p>
        Karochat is built on Supabase (hosted Postgres + Storage). Your data is
        stored in the Supabase project the operator has configured. The current
        region and provider are listed in the project README and may change as
        the platform scales.
      </p>

      <h2>Who can see your messages</h2>
      <p>
        Messages in a public room are visible to everyone who is a member of
        that room. Messages in a private room are visible only to the people
        who have joined with the invite code. The operator&rsquo;s database
        administrators have technical access to the underlying storage, as is
        true of any hosted service; we treat that access as for operational
        purposes only.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        Karochat sets cookies that are strictly necessary to keep you signed
        in. We do not use third-party tracking cookies for advertising.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        or delete the personal data we hold about you. You can delete your
        messages and your account by contacting the operator. If you live in
        the EEA, the UK, or California, you have additional rights under
        applicable law — please reach out and we will honour requests we
        reasonably believe to be genuine.
      </p>

      <h2>Children</h2>
      <p>
        Karochat is not directed at children under 13 (or under 16 where
        applicable). If you believe a child has provided us with personal
        data, please contact us so we can remove it.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this notice. Material changes will require renewed
        acceptance before you continue using the Service.
      </p>

      <p className="text-xs text-white/40">
        Questions about this notice can be sent to{" "}
        <a href="mailto:info@karochat.co" className="text-neon-blue underline">
          info@karochat.co
        </a>
        .
      </p>
    </>
  );
}
