// STUBBED PRISMA CLIENT FOR ENVIRONMENT COMPATIBILITY
// The environment is currently unable to run 'npx prisma generate' reliably.

const stub = new Proxy({}, {
    get: () => {
        return new Proxy(() => { }, {
            apply: () => Promise.resolve([]),
            get: () => stub
        });
    }
});

const prisma = stub as any;

export default prisma;
