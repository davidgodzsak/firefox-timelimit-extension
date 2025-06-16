import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyDirectory(src, dest) {
  try {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error(`Error copying directory ${src}:`, error);
    throw error;
  }
}

async function copyFile(src, dest) {
  try {
    const destDir = path.dirname(dest);
    await fs.promises.mkdir(destDir, { recursive: true });
    await fs.promises.copyFile(src, dest);
  } catch (error) {
    console.error(`Error copying file ${src}:`, error);
    throw error;
  }
}

async function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      console.log(`\nZip file created: ${outputPath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add all files from the dist directory
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function build() {
  const distDir = path.join(__dirname, 'dist');
  const manifestPath = path.join(__dirname, 'manifest.json');
  
  console.log('🏗️  Starting Firefox extension build...\n');

  try {
    // Read manifest to get version
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    const version = manifest.version;
    
    console.log(`📦 Building version ${version}`);

    // Clean dist directory
    if (fs.existsSync(distDir)) {
      await fs.promises.rm(distDir, { recursive: true });
      console.log('🧹 Cleaned dist directory');
    }

    // Create dist directory
    await fs.promises.mkdir(distDir, { recursive: true });
    console.log('📁 Created dist directory');

    // Copy manifest.json
    await copyFile(manifestPath, path.join(distDir, 'manifest.json'));
    console.log('✅ Copied manifest.json');

    // Copy essential directories
    const directoriesToCopy = ['background_scripts', 'ui', 'assets', '_locales'];
    
    for (const dir of directoriesToCopy) {
      const srcPath = path.join(__dirname, dir);
      const destPath = path.join(distDir, dir);
      
      if (fs.existsSync(srcPath)) {
        await copyDirectory(srcPath, destPath);
        console.log(`✅ Copied ${dir}/`);
      } else {
        console.log(`⚠️  Directory ${dir}/ not found, skipping`);
      }
    }

    // Create zip file
    const zipName = `timelimit-extension-v${version}.zip`;
    const zipPath = path.join(__dirname, zipName);
    
    if (fs.existsSync(zipPath)) {
      await fs.promises.unlink(zipPath);
    }

    await createZip(distDir, zipPath);
    console.log(`🎉 Build completed successfully!`);
    console.log(`📦 Extension package: ${zipName}`);

    // Show dist directory contents
    console.log('\n📋 Build contents:');
    const showDirectoryContents = async (dir, prefix = '') => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          console.log(`${prefix}📁 ${entry.name}/`);
          await showDirectoryContents(path.join(dir, entry.name), prefix + '  ');
        } else {
          console.log(`${prefix}📄 ${entry.name}`);
        }
      }
    };
    
    await showDirectoryContents(distDir);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build(); 