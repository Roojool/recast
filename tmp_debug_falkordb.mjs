import { FalkorDB } from 'falkordb';

async function main() {
  const client = await FalkorDB.connect({ url: 'redis://127.0.0.1:16380' });
  const g = client.selectGraph('recast-test-debug4');
  await g.delete().catch(() => {});

  // Test: CREATE without properties, then SET
  try {
    await g.query('CREATE (w:Workspace)', {});
    console.log('CREATE empty node: OK');
    await g.query('MATCH (w:Workspace) SET w.key = $k, w.wid = $wid', { params: { k: 'test-key', wid: 'test-id' } });
    console.log('SET properties: OK');

    const result = await g.roQuery('MATCH (w:Workspace) RETURN w.key AS key, w.wid AS wid', {});
    console.log('Read back:', JSON.stringify(result.data));
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  await g.delete().catch(() => {});
  await client.close();
}

main().catch(console.error);
