const { withAndroidManifest, withAppDelegate, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const exclusions = DOMAINS.map(domain => `    <exclude domain="${domain}" path="." />`).join('\n');
const backupRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${exclusions}
  </cloud-backup>
  <device-transfer>
${exclusions}
  </device-transfer>
</data-extraction-rules>
`;

const marker = '// Cadence: exclude local data from system backups before starting React.';
const anchor = '    let delegate = ReactNativeDelegate()';
const exclusion = `    ${marker}
    do {
      for location in [FileManager.SearchPathDirectory.documentDirectory, .applicationSupportDirectory] {
        var directory = try FileManager.default.url(
          for: location, in: .userDomainMask, appropriateFor: nil, create: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
      }
    } catch {
      // Do not start collecting audio if the local-storage protection cannot be applied.
      fatalError("Cadence could not exclude its local data from system backups.")
    }

`;

function injectBackupExclusion(contents) {
  if (contents.includes(marker)) return contents;
  if (!contents.includes(anchor)) throw new Error('Cadence backup protection: AppDelegate template changed; review the plugin.');
  return contents.replace(anchor, exclusion + anchor);
}

/** Native backup defaults otherwise include Documents, recordings, and SQLite data. */
function withLocalData(config) {
  config = withAndroidManifest(config, result => {
    const application = result.modResults.manifest.application[0].$;
    application['android:allowBackup'] = 'false';
    application['android:fullBackupContent'] = 'false';
    application['android:dataExtractionRules'] = '@xml/cadence_data_extraction_rules';
    return result;
  });
  config = withDangerousMod(config, ['android', async result => {
    const directory = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'cadence_data_extraction_rules.xml'), backupRules);
    return result;
  }]);
  return withAppDelegate(config, result => {
    if (result.modResults.language !== 'swift') throw new Error('Cadence backup protection requires the Swift AppDelegate.');
    result.modResults.contents = injectBackupExclusion(result.modResults.contents);
    return result;
  });
}

module.exports = withLocalData;
module.exports.injectBackupExclusion = injectBackupExclusion;
module.exports.backupRules = backupRules;
