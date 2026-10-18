import { FalkorDB } from 'falkordb';

const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });
const g = client.selectGraph('recast-ws-debug-test');

try { await g.delete(); } catch(e) { console.log('delete err:', e.message); }

await g.query(`CREATE (w:Workspace {key:'recast-ws-debug-test', workspaceId:'debug-test', revision:1, createdAt:'2026-10-18T08:00:00Z', scenario:'S1'})`);

const rows = [{id:'prod-hg', title:'Harbor Grey', contractDate:'2026-01-15T00:00:00Z'}, {id:'prod-la', title:'Late Amber', contractDate:'2026-02-01T00:00:00Z'}];
const reply = await g.query(
  `MATCH (w:Workspace {key:$wk}) UNWIND $rows AS row CREATE (w)-[:HAS_PRODUCTION]->(:Production {id: row.id, title: row.title, contractDate: row.contractDate})`,
  { params: { wk: 'recast-ws-debug-test', rows } }
);
console.log('create reply:', JSON.stringify(reply));

const readReply = await g.roQuery(
  `MATCH (w:Workspace {key:$wk})-[:HAS_PRODUCTION]->(p:Production) RETURN p.id AS id, p.title AS title`,
  { params: { wk: 'recast-ws-debug-test' } }
);
console.log('read reply data:', JSON.stringify(readReply.data));

await client.close();
