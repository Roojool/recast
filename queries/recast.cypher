-- Recast hero Cypher (PACT parity, Wave 1 flagship #2 — casting continuity)
-- Detects double-booking: an actor cast in two overlapping shoot blocks.
-- Tie-break: earlier contractDate keeps the actor.
MATCH (a:Actor {name:$name})-[:BOOKED_FOR]->(b1:ShootBlock)<-[:HAS_BLOCK]-(p1:Production),
      (a)-[:BOOKED_FOR]->(b2:ShootBlock)<-[:HAS_BLOCK]-(p2:Production)
WHERE b1.id < b2.id AND b1.start < b2.end AND b2.start < b1.end
OPTIONAL MATCH (u:Understudy)-[:UNDERSTUDIES]->(:Role)-[:CAST_TO]->(a)
RETURN p1.title, p2.title, b1, b2, collect(DISTINCT u.name) as understudies,
  [(r:Role)-[:CAST_TO]->(a) <-[:CONTINUITY_REQUIRES]-(n:ContinuityNote) | n.id] AS bindingNotes
