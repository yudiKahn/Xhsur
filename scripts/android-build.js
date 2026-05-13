const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd, cwd = process.cwd()) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd, shell: true });
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');
  }
}

function insertBefore(filePath, markerRegex, block) {
  ensureFile(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(block.trim())) {
    return;
  }

  const match = content.match(markerRegex);
  if (!match) {
    throw new Error(`Marker not found in ${filePath}`);
  }

  const updated =
    content.slice(0, match.index) +
    block +
    '\n\n' +
    content.slice(match.index);

  fs.writeFileSync(filePath, updated);
}

function insertIntoBlock(filePath, blockRegex, insertText) {
  ensureFile(filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(insertText.trim())) {
    return;
  }

  const match = content.match(blockRegex);
  if (!match) {
    throw new Error(`Target block not found in ${filePath}`);
  }

  const insertPos = match.index + match[0].length - 1;
  content =
    content.slice(0, insertPos) +
    '\n        ' +
    insertText.replace(/\n/g, '\n        ') +
    '\n' +
    content.slice(insertPos);

  fs.writeFileSync(filePath, content);
}

function appendProps(filePath, lines) {
  ensureFile(filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  lines.forEach((line) => {
    if (!content.includes(line)) {
      content += (content.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  });

  fs.writeFileSync(filePath, content);
}

function main() {
  const mode = process.argv[2] === 'debug' ? 'debug' : 'release';
  const rootDir = path.join(__dirname, '..');
  const androidDir = path.join(rootDir, 'android');
  const gradleFile = path.join(androidDir, 'app', 'build.gradle');
  const gradleTask = mode === 'debug' ? 'assembleDebug' : 'assembleRelease';

  const signingConfigsBlock = `
signingConfigs {
    release {
        if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
    }
}
`;

  if (fs.existsSync(androidDir)) {
    fs.rmSync(androidDir, { recursive: true, force: true });
  }

  run('npm run build', rootDir);
  run('npx cap add android', rootDir);
  run('npx @capacitor/assets generate --android', rootDir);

  insertBefore(gradleFile, /buildTypes\s*\{/, signingConfigsBlock);

  insertIntoBlock(
    gradleFile,
    /buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?\}/,
    `
minifyEnabled true
shrinkResources true
signingConfig signingConfigs.release
`
  );

  appendProps(path.join(androidDir, 'gradle.properties'), [
    'MYAPP_RELEASE_STORE_FILE=C\\:\\\\Users\\\\yudik\\\\Projects\\\\Private\\\\Kids\\\\yudi-release-key.jks',
    'MYAPP_RELEASE_STORE_PASSWORD=yudikahn',
    'MYAPP_RELEASE_KEY_ALIAS=yudi-key',
    'MYAPP_RELEASE_KEY_PASSWORD=yudikahn',
  ]);

  appendProps(path.join(androidDir, 'local.properties'), [
    'sdk.dir=C\\:\\\\Users\\\\yudik\\\\AppData\\\\Local\\\\Android\\\\Sdk',
  ]);

  run(`gradlew ${gradleTask}`, androidDir);

  const apkOutputDir =
    mode === 'debug'
      ? 'android\\app\\build\\outputs\\apk\\debug'
      : 'android\\app\\build\\outputs\\apk\\release';
  run(`explorer ${apkOutputDir}`, rootDir);
}

main();
