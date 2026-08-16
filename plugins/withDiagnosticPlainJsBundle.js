const { withXcodeProject } = require('expo/config-plugins');

const DIAGNOSTIC_ENV = 'OLIVEOPS_IOS_PLAIN_JS_BUNDLE';
const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const DIAGNOSTIC_MARKER = '# OliveOps diagnostic: embed plain JavaScript for Hermes';

function decodeShellScript(shellScript) {
  try {
    return JSON.parse(shellScript);
  } catch {
    return shellScript;
  }
}

function encodeShellScript(shellScript, originalShellScript) {
  try {
    JSON.parse(originalShellScript);
    return JSON.stringify(shellScript);
  } catch {
    return shellScript;
  }
}

function disableReleaseHermesBytecode(buildPhase) {
  if (!buildPhase || typeof buildPhase.shellScript !== 'string') {
    throw new Error(`Unable to find the '${BUNDLE_PHASE_NAME}' Xcode build phase.`);
  }

  const shellScript = decodeShellScript(buildPhase.shellScript);
  if (shellScript.includes(DIAGNOSTIC_MARKER)) {
    return;
  }

  const diagnosticOverride = [
    DIAGNOSTIC_MARKER,
    'if [ "$CONFIGURATION" = "Release" ]; then',
    '  export USE_HERMES=false',
    'fi',
    '',
  ].join('\n');

  buildPhase.shellScript = encodeShellScript(
    `${diagnosticOverride}${shellScript}`,
    buildPhase.shellScript
  );
}

function withDiagnosticPlainJsBundle(config) {
  if (process.env[DIAGNOSTIC_ENV] !== 'true') {
    return config;
  }

  return withXcodeProject(config, (configWithProject) => {
    const bundlePhase = configWithProject.modResults.pbxItemByComment(
      BUNDLE_PHASE_NAME,
      'PBXShellScriptBuildPhase'
    );

    disableReleaseHermesBytecode(bundlePhase);
    return configWithProject;
  });
}

module.exports = withDiagnosticPlainJsBundle;
module.exports.disableReleaseHermesBytecode = disableReleaseHermesBytecode;
