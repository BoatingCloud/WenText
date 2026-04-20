import { spawnSync } from 'node:child_process';

const dbType = process.env.DB_TYPE === 'mysql' ? 'mysql' : 'postgresql';
const schemaPath = dbType === 'mysql' ? 'prisma/schema.mysql.prisma' : 'prisma/schema.prisma';
const action = process.argv[2];
const extraArgs = process.argv.slice(3);
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const buildPrismaArgs = () => {
  switch (action) {
    case 'generate':
      return ['prisma', 'generate', '--schema', schemaPath, ...extraArgs];
    case 'validate':
      return ['prisma', 'validate', '--schema', schemaPath, ...extraArgs];
    case 'push':
      return ['prisma', 'db', 'push', '--schema', schemaPath, ...extraArgs];
    case 'studio':
      return ['prisma', 'studio', '--schema', schemaPath, ...extraArgs];
    case 'migrate-dev':
      if (dbType === 'mysql') {
        return ['prisma', 'db', 'push', '--schema', schemaPath, ...extraArgs];
      }
      return ['prisma', 'migrate', 'dev', '--schema', schemaPath, ...extraArgs];
    case 'migrate-deploy':
      if (dbType === 'mysql') {
        return ['prisma', 'db', 'push', '--schema', schemaPath, ...extraArgs];
      }
      return ['prisma', 'migrate', 'deploy', '--schema', schemaPath, ...extraArgs];
    default:
      console.error(`Unsupported Prisma action: ${action}`);
      process.exit(1);
  }
};

const result = spawnSync(npxCmd, buildPrismaArgs(), {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
