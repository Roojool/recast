import { FalkorDB } from 'falkordb';

async function main() {
  const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });

  // Test A: minimal UNWIND with $rows, no null
  let g = client.selectGraph('debug-a-' + Date.now());
  await g.query("CREATE (w:Workspace {key:'wk'})");
  const rowsA = [{ id: 'u1', name: 'Mina', roleId: 'r1' }];
  await g.query("MATCH (w:Workspace {key:$wk}) UNWIND $rows AS row CREATE (u:Node {id: row.id, name: row.name})", { params: { wk: 'wk', rows: rowsA } });
  const rA = await g.query("MATCH (u:Node) RETURN u.id AS id");
  console.log('Test A UNWIND no-null:', JSON.stringify(rA.data));

  // Test B: UNWIND with $rows containing null
  g = client.selectGraph('debug-b-' + Date.now());
  await g.query("CREATE (w:Workspace {key:'wk'})");
  const rowsB = [{ id: 'u1', name: 'Mina', sag: null }];
  await g.query("MATCH (w:Workspace {key:$wk}) UNWIND $rows AS row CREATE (u:Node {id: row.id, name: row.name, sag: row.sag})", { params: { wk: 'wk', rows: rowsB } });
  const rB = await g.query("MATCH (u:Node) RETURN u.id AS id, u.sag AS sag");
  console.log('Test B UNWIND with null:', JSON.stringify(rB.data));

  // Test C: UNWIND with MATCH on relationship (like understudy query)
  g = client.selectGraph('debug-c-' + Date.now());
  await g.query("CREATE (w:Workspace {key:'wk'})-[:HAS_PRODUCTION]->(p:Production {id:'prod-la'})-[:HAS_ROLE]->(r:Role {id:'role-la-lead'})");
  const rowsC = [{ roleId: 'role-la-lead' }];
  await g.query(
    `MATCH (w:Workspace {key:$wk})
     UNWIND $rows AS row
     MATCH (w)-[:HAS_PRODUCTION]->()-[:HAS_ROLE]->(r:Role {id: row.roleId})
     CREATE (u:Understudy {id: row.roleId})`,
    { params: { wk: 'wk', rows: rowsC } }
  );
  const rC = await g.query("MATCH (u:Understudy) RETURN u.id AS id");
  console.log('Test C UNWIND + MATCH pattern:', JSON.stringify(rC.data));

  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
