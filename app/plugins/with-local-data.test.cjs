const test = require('node:test');
const assert = require('node:assert/strict');
const { injectBackupExclusion, backupRules } = require('./with-local-data');

test('iOS applies protection before React starts and keeps regeneration idempotent', () => {
  const original = 'class AppDelegate {\n    let delegate = ReactNativeDelegate()\n}';
  const result = injectBackupExclusion(original);
  assert.ok(result.indexOf('try directory.setResourceValues(values)') < result.indexOf('let delegate'));
  assert.match(result, /documentDirectory, \.applicationSupportDirectory/);
  assert.equal(injectBackupExclusion(result), result);
});

test('an incompatible native template fails instead of silently omitting protection', () => {
  assert.throws(() => injectBackupExclusion('class NewDelegate {}'), /template changed/);
});

test('Android excludes private data from both cloud backup and device transfer', () => {
  for (const section of ['cloud-backup', 'device-transfer']) {
    const content = backupRules.split(`<${section}>`)[1].split(`</${section}>`)[0];
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external',
      'device_root', 'device_file', 'device_database', 'device_sharedpref']) {
      assert.ok(content.includes(`<exclude domain="${domain}" path="." />`));
    }
    assert.ok(!content.includes('<include'));
  }
});
