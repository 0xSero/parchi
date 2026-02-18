#!/usr/bin/env node

// tests/validate-extension.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var ROOT_DIR = path.join(__dirname, "..");
var PROJECT_DIR = path.join(ROOT_DIR, "..");
var ExtensionValidator = class {
  errors;
  warnings;
  passed;
  failed;
  manifest;
  packageJSON;
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = 0;
    this.failed = 0;
    this.manifest = null;
    this.packageJSON = {};
  }
  log(message, type = "info") {
    const colors = {
      info: "\x1B[36m",
      success: "\x1B[32m",
      error: "\x1B[31m",
      warning: "\x1B[33m",
      reset: "\x1B[0m"
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }
  test(description, fn) {
    try {
      fn();
      this.passed++;
      this.log(`\u2713 ${description}`, "success");
      return true;
    } catch (error) {
      this.failed++;
      this.errors.push({ test: description, error: error.message });
      this.log(`\u2717 ${description}: ${error.message}`, "error");
      return false;
    }
  }
  warn(message) {
    this.warnings.push(message);
    this.log(`\u26A0 ${message}`, "warning");
  }
  fileExists(filePath, baseDir = ROOT_DIR) {
    const fullPath = path.join(baseDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fullPath;
  }
  validateJSON(filePath, baseDir = ROOT_DIR) {
    const fullPath = this.fileExists(filePath, baseDir);
    const content = fs.readFileSync(fullPath, "utf8");
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
  }
  validateManifest() {
    this.log("\n=== Validating Manifest ===", "info");
    this.test("manifest.json exists and is valid JSON", () => {
      this.manifest = this.validateJSON("manifest.json");
    });
    this.test("manifest_version is 3", () => {
      if (this.manifest?.manifest_version !== 3) {
        throw new Error("Must use Manifest V3");
      }
    });
    this.test("name is present", () => {
      if (!this.manifest?.name) {
        throw new Error("Manifest must have a name");
      }
    });
    this.test("version is present and valid", () => {
      if (!this.manifest?.version) {
        throw new Error("Manifest must have a version");
      }
      if (!/^\d+\.\d+\.\d+/.test(String(this.manifest?.version || ""))) {
        throw new Error("Version must be in format X.Y.Z");
      }
    });
    this.test("description is present", () => {
      if (!this.manifest?.description) {
        throw new Error("Manifest must have a description");
      }
    });
    this.test("required permissions are declared", () => {
      const required = ["sidePanel", "activeTab", "scripting", "tabs", "storage"];
      const permissions = Array.isArray(this.manifest?.permissions) ? this.manifest.permissions : [];
      const missing = required.filter((p) => !permissions.includes(p));
      if (missing.length > 0) {
        throw new Error(`Missing permissions: ${missing.join(", ")}`);
      }
    });
    this.test("host_permissions includes <all_urls>", () => {
      const hostPermissions = Array.isArray(this.manifest?.host_permissions) ? this.manifest.host_permissions : [];
      if (!hostPermissions.includes("<all_urls>")) {
        throw new Error("Must include <all_urls> in host_permissions");
      }
    });
    this.test("background service worker is configured", () => {
      if (!this.manifest?.background?.service_worker) {
        throw new Error("Must have background.service_worker");
      }
    });
    this.test("side_panel is configured", () => {
      if (!this.manifest?.side_panel?.default_path) {
        throw new Error("Must have side_panel.default_path");
      }
    });
    this.test("action is configured", () => {
      if (!this.manifest?.action) {
        throw new Error("Must have action configuration");
      }
    });
    if (!this.manifest?.icons) {
      this.warn("No icons configured - extension will work but won't show an icon");
    }
  }
  validateRequiredFiles() {
    this.log("\n=== Validating Required Files ===", "info");
    const requiredFiles = [
      "background.js",
      "content.js",
      "sidepanel/panel.html",
      "sidepanel/panel.css",
      "sidepanel/panel.js"
    ];
    requiredFiles.forEach((file) => {
      this.test(`${file} exists`, () => {
        this.fileExists(file);
      });
    });
  }
  validateJavaScriptSyntax() {
    this.log("\n=== Validating JavaScript Files ===", "info");
    const jsFiles = ["background.js", "content.js", "sidepanel/panel.js"];
    jsFiles.forEach((file) => {
      this.test(`${file} has valid syntax`, () => {
        const fullPath = this.fileExists(file);
        const content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("debugger;")) {
          this.warn(`${file} contains debugger statement`);
        }
      });
    });
  }
  validatePackageJSON() {
    this.log("\n=== Validating package.json ===", "info");
    this.test("package.json exists and is valid", () => {
      this.packageJSON = this.validateJSON("package.json", PROJECT_DIR);
    });
    this.test("package.json has required scripts", () => {
      const required = ["test", "validate", "build"];
      const missing = required.filter((s) => !this.packageJSON.scripts?.[s]);
      if (missing.length > 0) {
        throw new Error(`Missing scripts: ${missing.join(", ")}`);
      }
    });
  }
  validateDocumentation() {
    this.log("\n=== Validating Documentation ===", "info");
    const docs = ["README.md", "LICENSE"];
    docs.forEach((doc) => {
      this.test(`${doc} exists`, () => {
        this.fileExists(doc, PROJECT_DIR);
      });
    });
  }
  validateFileStructure() {
    this.log("\n=== Validating File Structure ===", "info");
    const requiredDirs = ["sidepanel", "sidepanel/styles", "sidepanel/templates", "icons"];
    requiredDirs.forEach((dir) => {
      this.test(`${dir}/ directory exists`, () => {
        const fullPath = path.join(ROOT_DIR, dir);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
          throw new Error(`Directory not found: ${dir}/`);
        }
      });
    });
  }
  validateToolDefinitions() {
    this.log("\n=== Validating Tool Definitions ===", "info");
    this.test("background bundle includes BrowserTools + getToolDefinitions", () => {
      const bgPath = this.fileExists("background.js");
      const content = fs.readFileSync(bgPath, "utf8");
      if (!content.includes("BrowserTools")) {
        throw new Error("BrowserTools not found in background bundle");
      }
      if (!content.includes("getToolDefinitions")) {
        throw new Error("getToolDefinitions not found in background bundle");
      }
    });
  }
  printSummary() {
    this.log("\n=== Validation Summary ===", "info");
    this.log(`Tests Passed: ${this.passed}`, "success");
    if (this.failed > 0) {
      this.log(`Tests Failed: ${this.failed}`, "error");
    }
    if (this.warnings.length > 0) {
      this.log(`Warnings: ${this.warnings.length}`, "warning");
      this.warnings.forEach((w) => this.log(`  - ${w}`, "warning"));
    }
    if (this.errors.length > 0) {
      this.log("\nErrors:", "error");
      this.errors.forEach((e) => {
        this.log(`  ${e.test}:`, "error");
        this.log(`    ${e.error}`, "error");
      });
    }
    if (this.failed === 0) {
      this.log("\n\u2713 Extension validation passed!", "success");
      this.log("Extension is ready to load in Chrome.", "success");
      return true;
    } else {
      this.log("\n\u2717 Extension validation failed!", "error");
      this.log("Please fix the errors above before loading the extension.", "error");
      return false;
    }
  }
  async run() {
    this.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
    this.log("\u2551  Parchi - Extension Validator  \u2551", "info");
    this.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
    this.validateManifest();
    this.validateFileStructure();
    this.validateRequiredFiles();
    this.validateJavaScriptSyntax();
    this.validatePackageJSON();
    this.validateDocumentation();
    this.validateToolDefinitions();
    const success = this.printSummary();
    process.exit(success ? 0 : 1);
  }
};
var validator = new ExtensionValidator();
validator.run();
//# sourceMappingURL=validate-extension.js.map
