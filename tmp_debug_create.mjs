import { createWorkspace, closeGraphConnection, readWorkspace } from './src/lib/graph.ts';
import { createFixture } from './src/lib/business-setup.ts';

async function main() {
  const id = 'ws-debug-' + Date.now();
  const ws = await createWorkspace(id, createFixture(id, 'S1'));
  console.log('productions:', ws.productions.length);
  console.log('roles:', ws.roles.length);
  console.log('actors:', ws.actors.length);
  console.log('shootBlocks:', ws.shootBlocks.length);
  console.log('understudies:', ws.understudies.length, JSON.stringify(ws.understudies));
  console.log('lookTests:', ws.lookTestScores.length);
  console.log('continuityNotes:', ws.continuityNotes.length);
  console.log('unknowns:', ws.unknowns.length);

  // Now directly query the graph for understudies
  const { graphFor } = await import('./src/lib/graph');
  // can't access graphFor (not exported). Let's just re-read.
  const again = await readWorkspace(id);
  console.log('readWorkspace understudies:', again?.understudies.length, JSON.stringify(again?.understudies));

  await closeGraphConnection();
}
main().catch((e) => { console.error(e); process.exit(1); });
