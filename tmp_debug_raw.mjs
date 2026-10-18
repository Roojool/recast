import { FalkorDB } from 'falkordb';
import { validateWorkspaceId } from './src/lib/graph.ts';

const url = process.env.FALKORDB_URL || 'redis://127.0.0.1:16380';
const client = await FalkorDB.connect({ url });
const wk = 'recast-ws-' + validateWorkspaceId('debug-raw-' + Date.now());
const g = client.selectGraph(wk);

await g.query(`CREATE (w:Workspace {key:$wk, workspaceId:$wid, revision:1, createdAt:'2026-10-18T08:00:00Z', scenario:'S1'})`, { params: { wk, wid: 'debug-raw' } });
await g.query(`MATCH (w:Workspace {key:$wk}) CREATE (w)-[:HAS_PRODUCTION]->(:Production {id:'prod-la', title:'Late Amber', contractDate:'2026-02-01T00:00:00Z'})`, { params: { wk } });
await g.query(`MATCH (w:Workspace {key:$wk})-[:HAS_PRODUCTION]->(p:Production {id:'prod-la'}) CREATE (p)-[:HAS_ROLE]->(:Role {id:'role-la-lead', name:'Stand-in', productionId:'prod-la'})`, { params: { wk } });

// Now the understudy creation query exactly as in graph.ts
const rows = [{ id: 'understudy-mina', name: 'Mina', understudiesRoleId: 'role-la-lead', sagAvailabilityValidUntil: null }];
const res = await g.query(
  `MATCH (w:Workspace {key:$wk})
   UNWIND $rows AS row
   MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
   CREATE (w)-[:HAS_UNDERSTUDY]->(u:Understudy {
     id: row.id, name: row.name, understudiesRoleId: row.understudiesRoleId,
     sagAvailabilityValidUntil: row.sagAvailabilityValidUntil
   })
   CREATE (u)-[:UNDERSTUDIES]->(r)
   RETURN u.id AS id, u.name AS name, u.sagAvailabilityValidUntil AS sat`,
  { params: { wk, rows } },
);
console.log('UNDERSTUDY CREATE RESULT:', JSON.stringify(res.data));

const read = await g.query(`MATCH (w:Workspace {key:$wk})-[:HAS_UNDERSTUDY]->(u:Understudy) RETURN u.id AS id, u.name AS name, u.sagAvailabilityValidUntil AS sat`, { params: { wk } });
console.log('UNDERSTUDY READ RESULT:', JSON.stringify(read.data));

await client.close();
