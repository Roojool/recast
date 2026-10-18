import { FalkorDB } from 'falkordb';

const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });
const id = 'debug2-' + Date.now();
const wk = `recast-ws-${id}`;
const g = client.selectGraph(wk);

try { await g.delete(); } catch {}

// Create workspace + production + role (like graph.ts does)
await g.query(`CREATE (w:Workspace {key:$wk, workspaceId:$wid, revision:1})`,
  { params: { wk, wid: id } });
await g.query(
  `MATCH (w:Workspace {key:$wk}) UNWIND $rows AS row CREATE (w)-[:HAS_PRODUCTION]->(:Production {id: row.id})`,
  { params: { wk, rows: [{ id: 'prod-la' }] } },
);
await g.query(
  `MATCH (w:Workspace {key:$wk}) UNWIND $rows AS row MATCH (w)-[:HAS_PRODUCTION]->(p:Production {id: row.productionId}) CREATE (p)-[:HAS_ROLE]->(:Role {id: row.id})`,
  { params: { wk, rows: [{ id: 'role-la-lead', productionId: 'prod-la' }] } },
);

// Verify role exists
const check = await g.query(
  `MATCH (w:Workspace {key:$wk})-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: $rid}) RETURN r.id AS id`,
  { params: { wk, rid: 'role-la-lead' } }, true);
console.log('Role exists check:', JSON.stringify(check.data));

// Test 1: Understudy creation with anonymous node pattern (like graph.ts)
const res1 = await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
   CREATE (w)-[:HAS_UNDERSTUDY]->(u:Understudy {id: row.id, name: row.name, understudiesRoleId: row.roleId, sagUntil: null})
   RETURN count(u) as cnt`,
  { params: { wk, rows: [{ id: 'u1', name: 'Mina', roleId: 'role-la-lead' }] } },
);
console.log('Test 1 (anon node, null prop):', JSON.stringify(res1.data));

// Test 2: Understudy creation with named production variable
const res2 = await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   MATCH (w)-[:HAS_PRODUCTION]->(p:Production)-[:HAS_ROLE]->(r:Role {id: row.roleId})
   CREATE (w)-[:HAS_UNDERSTUDY2]->(u:Understudy2 {id: row.id, name: row.name})
   RETURN count(u) as cnt`,
  { params: { wk, rows: [{ id: 'u2', name: 'Mina2', roleId: 'role-la-lead' }] } },
);
console.log('Test 2 (named node, no null prop):', JSON.stringify(res2.data));

await client.close();
