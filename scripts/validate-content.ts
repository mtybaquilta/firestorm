import path from 'node:path';
import { loadAllContent } from '../src/content-loader/load';
import { buildRegistry } from '../src/content-loader/registry';

async function main() {
  const root = path.resolve(__dirname, '..', 'content');
  const content = await loadAllContent(root);
  const registry = buildRegistry(content);
  console.log(
    `OK: ${registry.towersById.size} towers, ${registry.creepsById.size} creeps, ${registry.mapsById.size} maps.`,
  );
}

main().catch((err) => {
  console.error('Content validation FAILED:');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
