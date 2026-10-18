import { FalkorDB } from 'falkordb';
import { createFixture } from './src/lib/business-setup.js';

const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });
const id = 'debug-under-' + Date.now();
const wk = `recast-ws-${id}`;
const g = client.selectGraph(wk);

try { await g.delete(); } catch {}

const fixture = createFixture(id, 'S1');
console.log('Understudies in fixture:', JSON.stringify(fixture.understudies));

// Create workspace node
await g.query(`CREATE (w:Workspace {key:$wk, workspaceId:$wid, revision:1, createdAt:$createdAt, scenario:$scenario})`,
  { params: { wk, wid: id, createdAt: fixture.createdAt, scenario: fixture.scenario } });

// Create roles first (needed by understudy creation)
await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   CREATE (w)-[:HAS_ROLE_DIRECT]->(:Role {id: row.id, name: row.name, productionId: row.productionId})`,
  { params: { wk, rows: fixture.roles.map((r) => ({ id: r.id, name: r.name, productionId: r.productionId })) } },
);

// Create productions
await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   CREATE (w)-[:HAS_PRODUCTION]->(:Production {id: row.id, title: row.title, contractDate: row.contractDate})`,
  { params: { wk, rows: fixture.productions.map((p) => ({ id: p.id, title: p.title, contractDate: p.contractDate })) } },
);

// Link roles to productions
await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   MATCH (w)-[:HAS_PRODUCTION]->(p:Production {id: row.productionId})
   CREATE (p)-[:HAS_ROLE]->(:Role {id: row.id, name: row.name, productionId: row.productionId})`,
  { params: { wk, rows: fixture.roles.map((r) => ({ id: r.id, name: r.name, productionId: r.productionId })) } },
);

// Create understudies
const rows = fixture.understudies.map((u) => ({
  id: u.id, name: u.name, understudiesRoleId: u.understudiesRoleId, sagAvailabilityValidUntil: u.sagAvailabilityValidUntil,
}));
console.log('Rows to create:', JSON.stringify(rows));

const res = await g.query(`
  MATCH (w:Workspace {key:$wk})
  UNWIND $rows AS row
  MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
  CREATE (w)-[:HAS_UNDERSTUDY]->(u:Understudy {
    id: row.id, name: row.name, understudiesRoleId: row.understudiesRoleId,
    sagAvailabilityValidUntil: row.sagAvailabilityValidUntil
  })
  CREATE (u)-[:UNDERSTUDIES]->(r)
  RETURN count(u) as cnt`,
  { params: { wk, rows } });

console.log('Create result:', JSON.stringify(res.data));

// Read back
const readRes = await g.query(`
  MATCH (w:Workspace {key:$wk})-[:HAS_UNDERSTUDY]->(u:Understudy)
  RETURN u.id AS id, u.name AS name, u.sagAvailabilityValidUntil AS sag`,
  { params: { wk } }, true);

console.log('Read result:', JSON.stringify(readRes.data));

await client.close();
