export const metadata = { title: "Community Guidelines — Karochat" };

export default function CommunityPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Community Guidelines</h1>
      <p className="text-sm text-white/40">Version 1</p>

      <p>
        Karochat is for everyone, everywhere. Rooms are how people find their
        people — by city, by college, by neighbourhood, by profession, by
        identity, by interest, by mood. The whole point is that you get to
        choose your room and your room gets to be itself.
      </p>

      <h2>Our basic ask</h2>
      <ol>
        <li><strong>Be kind.</strong> Treat people the way you&rsquo;d want to be treated.</li>
        <li><strong>Be real.</strong> Don&rsquo;t impersonate someone else to deceive or harm them.</li>
        <li><strong>Be respectful of consent.</strong> If someone asks you to stop, stop.</li>
        <li><strong>Mind the room.</strong> If you join a room, respect what it&rsquo;s for.</li>
      </ol>

      <h2>What we will not allow</h2>
      <ul>
        <li>Content that sexually depicts, exploits, or endangers minors.</li>
        <li>
          Hate speech and slurs targeting people for who they are (race,
          ethnicity, caste, religion, disability, gender, gender identity,
          sexual orientation, immigration status, serious disease, etc.).
        </li>
        <li>Threats of violence, calls for self-harm, or content glorifying mass violence.</li>
        <li>Non-consensual intimate imagery; doxxing; stalking.</li>
        <li>Coordinated harassment campaigns against an individual or community.</li>
        <li>Spam, scams, malware, and unauthorised advertising.</li>
      </ul>

      <h2>What we explicitly welcome</h2>
      <p>
        LGBTQIA+ rooms, identity-affirming rooms (by gender, sexuality, caste,
        community, religion, language, neighbourhood, college, profession), and
        regional rooms (continent, country, state, city, village) are all
        first-class. Examples like &ldquo;Chennai Friends&rdquo;, &ldquo;Delhi
        Lesbians&rdquo;, &ldquo;Hyderabad Coders&rdquo;, &ldquo;Alabama
        Alumni&rdquo;, &ldquo;NYC Realtors&rdquo;, &ldquo;Kerala Movie
        Buffs&rdquo;, and countless others are exactly what Karochat is for.
        These rooms are not subject to extra restrictions and will not be
        treated as second-class.
      </p>

      <h2>Public vs. private rooms</h2>
      <p>
        <strong>Public rooms</strong> are discoverable in the directory and
        anyone with a Karochat session can join. <strong>Private rooms</strong>{" "}
        are invite-code only. Both are subject to the same guidelines.
      </p>

      <h2>Joining and leaving</h2>
      <p>
        You can join or leave any room at any time without explanation. You do
        not need approval. Room owners may, in the future, mute or remove
        members from rooms they own; that&rsquo;s the only exception to free
        join/leave.
      </p>

      <h2>Reporting</h2>
      <p>
        Reporting is coming. In the meantime, if you encounter something that
        violates these guidelines, contact the operator listed in the README so
        we can act on it.
      </p>

      <p className="text-xs text-white/40">
        These guidelines are part of the{" "}
        <a href="/legal/terms">Terms of Use</a>.
      </p>
    </>
  );
}
