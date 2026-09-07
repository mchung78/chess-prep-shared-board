const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-chess-prep-shared-board';

const VALID_BOARD = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: { '0': 'e4', '1': 'e5' },
  updatedAt: 1234567890,
};

describe('chess-prep-shared-board database rules', function () {
  this.timeout(20000);
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      database: {
        rules: fs.readFileSync(path.join(__dirname, '..', 'rules.json'), 'utf8'),
        host: '127.0.0.1',
        port: 9000,
      },
    });
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  // Helper to seed admin config directly with admin (rules-bypassing) access.
  async function seedAdmin({ writesEnabled, authorizedUid }) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.database();
      const updates = {};
      if (writesEnabled !== undefined) updates['admin/writesEnabled'] = writesEnabled;
      if (authorizedUid) updates[`admin/authorizedWriters/${authorizedUid}`] = true;
      await db.ref().update(updates);
    });
  }

  describe('public read access', () => {
    it('allows unauthenticated reads of the board', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.database().ref('board').set(VALID_BOARD);
      });
      const unauth = testEnv.unauthenticatedContext();
      await assertSucceeds(unauth.database().ref('board').get());
    });

    it('allows authenticated reads of the board', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.database().ref('board').set(VALID_BOARD);
      });
      const auth = testEnv.authenticatedContext('some-uid');
      await assertSucceeds(auth.database().ref('board').get());
    });
  });

  describe('admin node lockdown', () => {
    it('denies unauthenticated reads of /admin', async () => {
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(unauth.database().ref('admin').get());
    });

    it('denies authenticated reads of /admin (no client should see the allowlist)', async () => {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      const auth = testEnv.authenticatedContext('writer-1');
      await assertFails(auth.database().ref('admin').get());
    });

    it('denies client writes to /admin regardless of auth', async () => {
      const auth = testEnv.authenticatedContext('writer-1');
      await assertFails(auth.database().ref('admin/writesEnabled').set(true));
    });
  });

  describe('write access control', () => {
    it('denies writes from an unauthenticated client', async () => {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      const unauth = testEnv.unauthenticatedContext();
      await assertFails(unauth.database().ref('board').set(VALID_BOARD));
    });

    it('denies writes from an authenticated but non-allowlisted user', async () => {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      const auth = testEnv.authenticatedContext('random-uid');
      await assertFails(auth.database().ref('board').set(VALID_BOARD));
    });

    it('denies writes from an allowlisted user when the kill switch is off', async () => {
      await seedAdmin({ writesEnabled: false, authorizedUid: 'writer-1' });
      const auth = testEnv.authenticatedContext('writer-1');
      await assertFails(auth.database().ref('board').set(VALID_BOARD));
    });

    it('allows writes from an allowlisted user when writes are enabled', async () => {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      const auth = testEnv.authenticatedContext('writer-1');
      await assertSucceeds(auth.database().ref('board').set(VALID_BOARD));
    });

    it('re-denies writes immediately after the kill switch flips off', async () => {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      const auth = testEnv.authenticatedContext('writer-1');
      const db = auth.database();
      await assertSucceeds(db.ref('board').set(VALID_BOARD));
      await seedAdmin({ writesEnabled: false });
      await assertFails(db.ref('board').set(VALID_BOARD));
    });
  });

  describe('board schema validation (for an allowlisted, enabled writer)', () => {
    async function allowedWriterCtx() {
      await seedAdmin({ writesEnabled: true, authorizedUid: 'writer-1' });
      return testEnv.authenticatedContext('writer-1');
    }

    it('rejects a board write missing required fields', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(auth.database().ref('board').set({ fen: VALID_BOARD.fen }));
    });

    it('rejects a fen longer than 100 characters', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          fen: 'x'.repeat(101),
        })
      );
    });

    it('accepts a fen at exactly the 100 character boundary', async () => {
      const auth = await allowedWriterCtx();
      await assertSucceeds(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          fen: 'x'.repeat(100),
        })
      );
    });

    it('rejects a non-numeric-index key in moves', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          moves: { first: 'e4' },
        })
      );
    });

    it('rejects a move value longer than 10 characters', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          moves: { '0': 'x'.repeat(11) },
        })
      );
    });

    it('rejects updatedAt that is not a number', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          updatedAt: 'not-a-number',
        })
      );
    });

    it('rejects an unexpected sibling key alongside board', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(auth.database().ref('somethingElse').set({ foo: 'bar' }));
    });

    it('rejects an extra unexpected key inside board', async () => {
      const auth = await allowedWriterCtx();
      await assertFails(
        auth.database().ref('board').set({
          ...VALID_BOARD,
          extraField: 'not allowed',
        })
      );
    });

    it('accepts a fully valid board write', async () => {
      const auth = await allowedWriterCtx();
      await assertSucceeds(auth.database().ref('board').set(VALID_BOARD));
    });
  });
});
