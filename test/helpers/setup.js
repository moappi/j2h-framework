/**
 * Global mocha bootstrap (loaded via .mocharc.json "require").
 *
 * - Exposes chai's `expect` globally so test files don't need to import it individually.
 * - Fails a test loudly on unhandled promise rejections so async bugs in the
 *   framework (e.g. a swallowed rejection inside Page.render) don't disappear silently.
 *
 * IMPORTANT: files loaded via mocha's `--require` run BEFORE mocha injects
 * the BDD globals (`describe`/`it`/`beforeEach`/`afterEach`/...) into scope,
 * so this file can't just call `afterEach(...)` at the top level - that was
 * throwing `ReferenceError: afterEach is not defined`. Root hooks declared
 * from a required file must instead use Mocha's "root hook plugin" API
 * (`exports.mochaHooks`), which Mocha picks up and wires in itself once the
 * real test globals exist.
 * https://mochajs.org/#root-hook-plugins
 */
"use strict";

const chai = require("chai");
global.expect = chai.expect;

let pending = [];

process.on("unhandledRejection", (reason) => {
    pending.push(reason);
    // eslint-disable-next-line no-console
    console.error("UNHANDLED REJECTION DURING TESTS:", reason);
});

exports.mochaHooks = {
    afterEach() {
        if (pending.length) {
            let err = pending.shift();
            throw err;
        }
    }
};
