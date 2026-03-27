#!/usr/bin/env node
/**
 * Deep Import/Export Chain Analysis
 * Traces all import chains and identifies:
 * - Dead-end exports (imported but not used)
 * - Orphaned modules (no consumers)
 * - Single-use abstractions
 * - Import chain depth analysis
 */

const fs = require('fs');
const path = require('path');

const EXTENSION_DIR = path.resolve('/Users/sero/projects/browser-ai/packages/extension');

// File cache
const fileCache = new Map();

function readFile(filePath) {
  if (fileCache.has(filePath)) return fileCache.get(filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    fileCache.set(filePath, content);
    return content;
  } catch {
    return null;
  }
}

// Parse imports from file
function parseImports(content) {
  const imports = [];

  // ES6 imports
  const es6Regex = /import\s+(?:(?:type\s+)?\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"];?/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    const namedImports = match[1];
    const namespaceImport = match[2];
    const defaultImport = match[3];
    const source = match[4];

    if (namedImports) {
      namedImports.split(',').forEach(imp => {
        const clean = imp.trim().replace(/^type\s+/, '').split('\s+as\s+')[0].trim();
        if (clean) imports.push({ name: clean, source, type: 'named' });
      });
    }
    if (namespaceImport) imports.push({ name: namespaceImport, source, type: 'namespace' });
    if (defaultImport) imports.push({ name: defaultImport, source, type: 'default' });
  }

  // Side-effect imports
  const sideEffectRegex = /import\s+['"]([^'"]+)['"];?/g;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    imports.push({ source: match[1], type: 'side-effect' });
  }

  return imports;
}

// Parse exports from file
function parseExports(content) {
  const exports = [];

  // Named exports: export { a, b } or export const x = ...
  const namedExportRegex = /export\s+(?:type\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }

  // Export { x, y } from './module'
  const reExportRegex = /export\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?;?/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
    const source = match[2];
    items.forEach(name => {
      exports.push({ name, type: 're-export', source });
    });
  }

  // export * from './module'
  const starExportRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"];?/g;
  while ((match = starExportRegex.exec(content)) !== null) {
    exports.push({ name: '*', type: 'star-export', source: match[1] });
  }

  // Default export
  const defaultRegex = /export\s+default\s+(?:(?:class|function)\s+(\w+)|(\w+))/;
  const defaultMatch = content.match(defaultRegex);
  if (defaultMatch) {
    exports.push({ name: defaultMatch[1] || defaultMatch[2] || 'default', type: 'default' });
  }

  return exports;
}

// Resolve import source to actual file path
function resolveImportSource(source, currentFile) {
  if (!source.startsWith('.')) return null; // Skip node_modules

  const currentDir = path.dirname(currentFile);
  // Remove .js extension if present (TypeScript allows importing .js to resolve to .ts)
  const cleanSource = source.replace(/\.js$/, '');
  const basePath = path.resolve(currentDir, cleanSource);

  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

// Check if an imported name is actually used in the file
function isUsedInFile(name, content, importStatement) {
  // Remove the import statement itself
  const contentWithoutImport = content.replace(importStatement, '');

  // Check for usage patterns
  const usagePatterns = [
    new RegExp(`\\b${name}\\s*\\(`, 'g'),      // function call
    new RegExp(`\\b${name}\\.`, 'g'),         // property access
    new RegExp(`\\b${name}\\b`, 'g'),         // any reference
    new RegExp(`:\\s*${name}\\b`, 'g'),       // type annotation
    new RegExp(`<${name}>`, 'g'),              // generic type
    new RegExp(`extends\\s+${name}\\b`, 'g'), // class extension
    new RegExp(`implements\\s+${name}\\b`, 'g'), // interface implementation
  ];

  let totalMatches = 0;
  for (const pattern of usagePatterns) {
    const matches = contentWithoutImport.match(pattern);
    if (matches) totalMatches += matches.length;
  }

  return totalMatches > 0;
}

// Find all TypeScript files
function findAllFiles(dir) {
  const files = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

// Main analysis
function analyze() {
  const files = findAllFiles(EXTENSION_DIR);
  console.log(`Found ${files.length} TypeScript files\n`);

  // Build export and import maps
  const exportMap = new Map(); // file -> [{name, type, source}]
  const importMap = new Map(); // file -> [{name, source, type, statement}]
  const allExports = new Map(); // "file:name" -> {file, name, type, importedBy: []}

  // First pass: collect all exports
  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    const exports = parseExports(content);
    exportMap.set(file, exports);

    for (const exp of exports) {
      const key = `${file}:${exp.name}`;
      allExports.set(key, { ...exp, file, importedBy: [], usedInTests: false });
    }
  }

  // Second pass: collect all imports and link to exports
  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    const imports = parseImportsWithStatement(content);
    importMap.set(file, imports);

    for (const imp of imports) {
      if (imp.type === 'side-effect') continue;

      const resolvedSource = resolveImportSource(imp.source, file);
      if (!resolvedSource) continue;

      const exportKey = `${resolvedSource}:${imp.name}`;
      const exportInfo = allExports.get(exportKey);

      if (exportInfo) {
        // Check if the import is actually used in the file
        const isActuallyUsed = isUsedInFile(imp.name, content, imp.statement);
        exportInfo.importedBy.push({
          file,
          used: isActuallyUsed,
          name: imp.name
        });
        if (file.includes('.test.') || file.includes('/tests/')) {
          exportInfo.usedInTests = true;
        }
      }
    }
  }

  // Analysis results
  const results = {
    totalFiles: files.length,
    totalExports: allExports.size,
    orphanedModules: [],
    deadEndExports: [],
    testOnlyExports: [],
    unimportedExports: [],
    suspiciousImports: [],
    barrelChains: [],
    mostConnected: [],
    leastConnected: [],
    importChains: [],
    singleImplementationInterfaces: [],
  };

  // Find orphaned modules (import but nothing imports from them)
  for (const file of files) {
    const hasExports = exportMap.get(file)?.length > 0;
    const exports = exportMap.get(file) || [];
    const hasImports = importMap.get(file)?.some(i => i.type !== 'side-effect');

    // A file is orphaned if it has exports but none of them are imported by other files
    const isConsumed = exports.some(exp => {
      const key = `${file}:${exp.name}`;
      const info = allExports.get(key);
      return info && info.importedBy.length > 0;
    });

    if (hasExports && !isConsumed && !file.endsWith('.d.ts')) {
      // Check if it's an entry point
      const isEntryPoint = file.includes('background.ts') ||
                          file.includes('content.ts') ||
                          file.includes('panel.ts');
      if (!isEntryPoint) {
        results.orphanedModules.push({
          file: path.relative(EXTENSION_DIR, file),
          hasImports: !!hasImports,
          exportCount: exports.length
        });
      }
    }
  }

  // Analyze exports
  const connectionCounts = [];
  for (const [key, exp] of allExports) {
    const consumerCount = exp.importedBy.filter(f => !f.file.includes('.test.')).length;
    const actuallyUsedCount = exp.importedBy.filter(f => f.used && !f.file.includes('.test.')).length;
    connectionCounts.push({ file: exp.file, name: exp.name, count: consumerCount, used: actuallyUsedCount });

    if (exp.importedBy.length === 0) {
      results.unimportedExports.push({
        file: path.relative(EXTENSION_DIR, exp.file),
        name: exp.name,
        type: exp.type
      });
    } else if (consumerCount === 0 && exp.importedBy.length > 0) {
      results.testOnlyExports.push({
        file: path.relative(EXTENSION_DIR, exp.file),
        name: exp.name,
        testFiles: exp.importedBy.map(f => path.relative(EXTENSION_DIR, f.file))
      });
    }

    // Check for suspicious imports (imported but never used)
    const suspiciousConsumers = exp.importedBy.filter(i => !i.used && !i.file.includes('.test.'));
    if (suspiciousConsumers.length > 0) {
      results.suspiciousImports.push({
        file: path.relative(EXTENSION_DIR, exp.file),
        name: exp.name,
        importedBy: suspiciousConsumers.map(c => path.relative(EXTENSION_DIR, c.file))
      });
    }

    // Track barrel re-exports
    if (exp.type === 're-export' || exp.type === 'star-export') {
      results.barrelChains.push({
        file: path.relative(EXTENSION_DIR, exp.file),
        name: exp.name,
        reExportsFrom: exp.source,
        finalConsumers: actuallyUsedCount
      });
    }
  }

  // Sort by connection count
  connectionCounts.sort((a, b) => b.count - a.count);
  results.mostConnected = connectionCounts.slice(0, 20).map(c => ({
    file: path.relative(EXTENSION_DIR, c.file),
    name: c.name,
    consumerCount: c.count,
    actuallyUsed: c.used
  }));
  results.leastConnected = connectionCounts.filter(c => c.count > 0).slice(-20).map(c => ({
    file: path.relative(EXTENSION_DIR, c.file),
    name: c.name,
    consumerCount: c.count,
    actuallyUsed: c.used
  }));

  // Find potential single-implementation interfaces
  const interfaceExports = [...allExports.values()].filter(e => {
    const content = readFile(e.file);
    return content && (
      content.includes(`interface ${e.name}`) ||
      content.includes(`type ${e.name} =`) ||
      content.includes(`abstract class ${e.name}`)
    );
  });

  for (const iface of interfaceExports) {
    // Check for implementations
    const implementations = [];
    for (const file of files) {
      const content = readFile(file);
      if (!content) continue;

      // Look for class implements or concrete usage
      const implementsPattern = new RegExp(`(class|const)\\s+\\w+.*?\\b${iface.name}\\b`, 'i');
      if (implementsPattern.test(content) && !content.includes(`interface ${iface.name}`)) {
        implementations.push(path.relative(EXTENSION_DIR, file));
      }
    }

    if (implementations.length === 1) {
      results.singleImplementationInterfaces.push({
        interface: iface.name,
        definedIn: path.relative(EXTENSION_DIR, iface.file),
        singleImplementation: implementations[0]
      });
    }
  }

  // Find import chains
  const chainDepths = [];
  for (const file of files) {
    const depth = calculateImportDepth(file, importMap, new Set());
    if (depth > 0) {
      chainDepths.push({ file: path.relative(EXTENSION_DIR, file), depth });
    }
  }
  chainDepths.sort((a, b) => b.depth - a.depth);
  results.importChains = chainDepths.slice(0, 30);

  return results;
}

// Calculate import chain depth for a file
function calculateImportDepth(file, importMap, visited) {
  if (visited.has(file)) return 0;
  visited.add(file);

  const imports = importMap.get(file) || [];
  const localImports = imports.filter(i => i.source?.startsWith('.'));

  if (localImports.length === 0) return 0;

  let maxDepth = 0;
  for (const imp of localImports) {
    const resolved = resolveImportSource(imp.source, file);
    if (resolved) {
      const depth = calculateImportDepth(resolved, importMap, new Set(visited));
      maxDepth = Math.max(maxDepth, depth + 1);
    }
  }

  return maxDepth;
}

// Parse imports with original statement for context
function parseImportsWithStatement(content) {
  const imports = [];

  // ES6 imports
  const es6Regex = /import\s+(?:(?:type\s+)?\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"];?/g;
  let match;
  while ((match = es6Regex.exec(content)) !== null) {
    const namedImports = match[1];
    const namespaceImport = match[2];
    const defaultImport = match[3];
    const source = match[4];
    const statement = match[0];

    if (namedImports) {
      namedImports.split(',').forEach(imp => {
        const clean = imp.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (clean) imports.push({ name: clean, source, type: 'named', statement });
      });
    }
    if (namespaceImport) imports.push({ name: namespaceImport, source, type: 'namespace', statement });
    if (defaultImport) imports.push({ name: defaultImport, source, type: 'default', statement });
  }

  // Side-effect imports
  const sideEffectRegex = /import\s+['"]([^'"]+)['"];?/g;
  while ((match = sideEffectRegex.exec(content)) !== null) {
    imports.push({ source: match[1], type: 'side-effect', statement: match[0] });
  }

  return imports;
}

// Run analysis
const results = analyze();

console.log('='.repeat(80));
console.log('DEEP IMPORT/EXPORT CHAIN ANALYSIS REPORT');
console.log('='.repeat(80));

console.log(`\n📊 OVERVIEW`);
console.log(`   Total Files: ${results.totalFiles}`);
console.log(`   Total Exports: ${results.totalExports}`);
console.log(`   Orphaned Modules: ${results.orphanedModules.length}`);
console.log(`   Unimported Exports: ${results.unimportedExports.length}`);
console.log(`   Test-Only Exports: ${results.testOnlyExports.length}`);
console.log(`   Suspicious Imports (unused): ${results.suspiciousImports.length}`);

console.log(`\n🔴 ORPHANED MODULES (${results.orphanedModules.length})`);
console.log(`   Files that export but are never imported (excluding entry points)`);
results.orphanedModules.forEach(m => {
  console.log(`   - ${m.file} ${m.hasImports ? '(has imports but no exports consumed)' : ''}`);
});

console.log(`\n🧪 TEST-ONLY EXPORTS (${results.testOnlyExports.length})`);
results.testOnlyExports.slice(0, 15).forEach(e => {
  console.log(`   - ${e.file}#${e.name}`);
});
if (results.testOnlyExports.length > 15) {
  console.log(`   ... and ${results.testOnlyExports.length - 15} more`);
}

console.log(`\n📦 UNIMPORTED EXPORTS (${results.unimportedExports.length})`);
results.unimportedExports.slice(0, 15).forEach(e => {
  console.log(`   - ${e.file}#${e.name} (${e.type})`);
});
if (results.unimportedExports.length > 15) {
  console.log(`   ... and ${results.unimportedExports.length - 15} more`);
}

console.log(`\n🛢️ BARREL RE-EXPORT CHAINS (${results.barrelChains.length})`);
results.barrelChains.slice(0, 10).forEach(b => {
  console.log(`   - ${b.file} re-exports ${b.name} from ${b.reExportsFrom} (${b.finalConsumers} consumers)`);
});

console.log(`\n🔗 MOST CONNECTED EXPORTS (Top 20)`);
results.mostConnected.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.file}#${c.name} (${c.consumerCount} consumers)`);
});

console.log(`\n🔌 LEAST CONNECTED EXPORTS (Bottom 20, excluding unused)`);
results.leastConnected.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.file}#${c.name} (${c.consumerCount} consumers)`);
});

console.log(`\n🚫 SUSPICIOUS IMPORTS (${results.suspiciousImports.length})`);
console.log(`   Imports that are imported but never actually used (excluding tests)`);
results.suspiciousImports.slice(0, 15).forEach(s => {
  console.log(`   - ${s.file}#${s.name}`);
  console.log(`     Imported by: ${s.importedBy.slice(0, 3).join(', ')}${s.importedBy.length > 3 ? '...' : ''}`);
});
if (results.suspiciousImports.length > 15) {
  console.log(`   ... and ${results.suspiciousImports.length - 15} more`);
}

console.log(`\n⛓️ IMPORT CHAIN DEPTH (Top 30 deepest)`);
results.importChains.forEach((c, i) => {
  console.log(`   ${i + 1}. ${c.file} (depth: ${c.depth})`);
});

console.log(`\n⚠️ SINGLE-IMPLEMENTATION INTERFACES (${results.singleImplementationInterfaces.length})`);
results.singleImplementationInterfaces.forEach(i => {
  console.log(`   - ${i.interface} in ${i.definedIn}`);
  console.log(`     Single implementation: ${i.singleImplementation}`);
});

// Write detailed JSON report
const reportPath = '/Users/sero/projects/browser-ai/deep-import-analysis-report.json';
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n✅ Detailed report written to: ${reportPath}`);
console.log(`   JSON data available for programmatic analysis`);
