export const metadata = {
  title: 'Recast Blog — Casting continuity notes',
  description: 'Editorial notes on casting continuity, union hours, and shoot-block planning.',
};

export default function BlogPage() {
  return (
    <section className="pact-content-container">
      <div className="wrap">
        <div className="paper-card" style={{ padding: '48px 64px', maxWidth: 720, margin: '0 auto' }}>
          <div className="editorial-label">Recast · Studio journal</div>
          <h1 className="editorial-headline" style={{ fontSize: '2.6rem', marginBottom: '1rem' }}>Casting continuity &amp; the shoot plan</h1>
          <p style={{ color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Recast is the casting continuity studio. Every shoot block is a node on the graph; every
            casting decision is a traversal. We model productions, roles, actors, look tests, continuity
            notes, and availability windows — then prove which repairs keep the schedule honest without
            breaking continuity or double-booking talent.
          </p>
          <p style={{ color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            The hero scenario: Actor Vera is double-booked across Block B-7 (Harbor Grey) and Block B-9
            (Late Amber), which overlap two days. Harbor Grey holds the earlier contract, so Vera keeps
            B-7. The valid repair promotes understudy Mina for the non-continuity coverage days of B-9,
            while Vera shoots only the two continuity-critical scenes. Cole is rejected — failed look test
            (41/100) and height-mismatched against continuity note CN-12.
          </p>
          <p style={{ color: 'var(--ink-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            All data is fictional. All checks are deterministic and replayable on FalkorDB; live AI
            overlays (Groq → OpenRouter → deterministic) are clearly badged and never substituted for
            graph truth.
          </p>
        </div>
      </div>
    </section>
  );
}
