import { FalkorDB } from 'falkordb';

async function main() {
  const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });
  const g = client.selectGraph('recast-test-debug5');
  await g.delete().catch(() => {});

  // Test: CREATE with inline scalar properties
  try {
    await g.query(
      'CREATE (w:Workspace {key: $wk, wid: $wid, revision: 1})',
      { params: { wk: 'test-key', wid: 'test-id' } }
    );
    console.log('CREATE with inline scalar props: OK');
  } catch (e) {
    console.log('CREATE inline scalar ERROR:', e.message);
  }

  // Test: CREATE relationship with inline properties from scalar params
  try {
    await g.query(
      'MATCH (w:Workspace {key: $wk}) CREATE (w)-[:HAS_PRODUCTION]->(p:Production {id: $pid, title: $title})',
      { params: { wk: 'test-key', pid: 'p1', title: 'Prod 1' } }
    );
    console.log('CREATE rel with inline scalar props: OK');
  } catch (e) {
    console.log('CREATE rel inline scalar ERROR:', e.message);
  }

  await g.delete().catch(() => {});
  await client.close();
}

main().catch(console.error);
