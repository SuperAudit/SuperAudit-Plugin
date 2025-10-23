import parser from "@solidity-parser/parser";
import { readFileSync, existsSync } from "fs";
import { glob } from "glob";
import { join } from "path";
import type { ASTNode } from "./types.js";

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly originalError?: Error
  ) {
    super(`Parse error in ${filePath}: ${message}`);
    this.name = "ParseError";
  }
}

export interface ParseResult {
  ast: ASTNode;
  filePath: string;
  sourceCode: string;
}

/**
 * Parse a single Solidity source file into an AST
 */
export function parseSourceFile(filePath: string): ParseResult {
  if (!existsSync(filePath)) {
    throw new ParseError(`File does not exist: ${filePath}`, filePath);
  }

  try {
    const sourceCode = readFileSync(filePath, "utf8");
    
    // Parse with location tracking enabled for precise error reporting
    const ast = parser.parse(sourceCode, { 
      loc: true,
      range: true
    });

    return {
      ast,
      filePath,
      sourceCode
    };
  } catch (error) {
    if (error instanceof parser.ParserError) {
      throw new ParseError(
        `Syntax error: ${error.errors.map(e => e.message).join(', ')}`,
        filePath,
        error
      );
    }
    
    throw new ParseError(
      `Unexpected error during parsing: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Discover all Solidity files in the given directory using glob patterns
 */
export async function getAllSolidityFiles(contractsPath: string): Promise<string[]> {
  const pattern = join(contractsPath, "**/*.sol");
  
  try {
    const files = await glob(pattern, {
      absolute: true,
      ignore: ["**/node_modules/**", "**/artifacts/**", "**/cache/**"]
    });
    
    return files;
  } catch (error) {
    throw new Error(
      `Failed to discover Solidity files in ${contractsPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Parse all Solidity files in a directory
 */
export async function parseAllSourceFiles(contractsPath: string): Promise<ParseResult[]> {
  const filePaths = await getAllSolidityFiles(contractsPath);
  const results: ParseResult[] = [];
  const errors: ParseError[] = [];

  for (const filePath of filePaths) {
    try {
      const result = parseSourceFile(filePath);
      results.push(result);
    } catch (error) {
      if (error instanceof ParseError) {
        errors.push(error);
      } else {
        errors.push(new ParseError(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          filePath,
          error instanceof Error ? error : undefined
        ));
      }
    }
  }

  // If we have parse errors, we might want to report them but not fail completely
  // For now, we'll throw if any files fail to parse
  if (errors.length > 0) {
    throw new Error(
      `Failed to parse ${errors.length} file(s):\n${errors.map(e => e.message).join('\n')}`
    );
  }

  return results;
}
